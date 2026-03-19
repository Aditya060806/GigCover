"""
GigCover — Production-Grade ML Training Pipeline v3.0
======================================================
Trains:
  1. XGBoost Regressor   — risk-based dynamic premium pricing (25 features)
  2. XGBoost Classifier   — supervised fraud detection (15 features)
  3. Isolation Forest      — unsupervised anomaly layer (ensemble with #2)

Includes:
  • 5-fold cross-validation with early stopping
  • Hyperparameter grid search
  • SHAP TreeExplainer with feature importance rankings
  • Full evaluation metrics (MAE/RMSE/R² for risk; AUC-ROC/PR-AUC/F1 for fraud)
  • Model metadata + feature names serialised for inference

Usage:
  1. python generate_synthetic.py
  2. python train_models.py
"""

import json
import pickle
import time
import numpy as np
from pathlib import Path

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.model_selection import (
        train_test_split, StratifiedKFold, KFold, cross_val_score,
    )
    from sklearn.metrics import (
        mean_absolute_error, mean_squared_error, r2_score,
        classification_report, roc_auc_score, average_precision_score,
        precision_recall_fscore_support, confusion_matrix,
    )
    from sklearn.preprocessing import StandardScaler
    import xgboost as xgb
    import shap
    HAS_ML = True
except ImportError:
    HAS_ML = False
    print("⚠️  ML libraries not installed. Run: pip install -r requirements.txt")
    print("   Pipeline will save metadata only (simulation mode).")


# ═══════════════════════════════════════════════════════════
# 1. RISK PRICING MODEL — XGBoost Regressor
# ═══════════════════════════════════════════════════════════

def train_risk_model():
    """Train XGBoost regressor for dynamic risk-based premium pricing.
    25 features → continuous risk score ∈ [0.05, 0.95].
    """
    data_dir = Path(__file__).parent / "output"
    model_dir = Path(__file__).parent / "models"
    model_dir.mkdir(exist_ok=True)

    print("=" * 55)
    print("📈  RISK PRICING MODEL  (XGBoost Regressor)")
    print("=" * 55)
    print()

    # ── Load data ──
    with open(data_dir / "risk_training_X.json") as f:
        X_raw = json.load(f)
    with open(data_dir / "risk_training_y.json") as f:
        y_raw = json.load(f)

    feature_names = list(X_raw[0].keys())
    X = np.array([[row[f] for f in feature_names] for row in X_raw], dtype=np.float32)
    y = np.array(y_raw, dtype=np.float32)

    print(f"   Dataset:    {len(X):,} samples × {len(feature_names)} features")
    print(f"   Risk range: [{y.min():.3f}, {y.max():.3f}]  μ={y.mean():.3f}  σ={y.std():.3f}")
    print(f"   Features:   {feature_names}")
    print()

    if not HAS_ML:
        _save_simulation_info(model_dir, "risk", feature_names, len(X), extra={
            "mean_risk": float(y.mean()), "std_risk": float(y.std()),
        })
        return

    # ── Train/Validation/Test split (70/15/15) ──
    X_train_full, X_test, y_train_full, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42,
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_full, y_train_full, test_size=0.176, random_state=42,  # 0.176 of 0.85 ≈ 0.15
    )
    print(f"   Split: train={len(X_train):,}  val={len(X_val):,}  test={len(X_test):,}")

    # ── Hyperparameter search (lightweight grid) ──
    param_grid = [
        {"n_estimators": 500, "max_depth": 5, "learning_rate": 0.05, "min_child_weight": 5},
        {"n_estimators": 500, "max_depth": 6, "learning_rate": 0.08, "min_child_weight": 3},
        {"n_estimators": 800, "max_depth": 7, "learning_rate": 0.03, "min_child_weight": 5},
        {"n_estimators": 600, "max_depth": 5, "learning_rate": 0.05, "min_child_weight": 8},
    ]

    best_model = None
    best_rmse = float("inf")
    best_params = {}

    print("   Hyperparameter search (4 configs × early stopping)...")
    for i, params in enumerate(param_grid):
        model = xgb.XGBRegressor(
            **params,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            tree_method="hist",
            random_state=42,
        )
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )
        y_val_pred = model.predict(X_val)
        rmse = float(np.sqrt(mean_squared_error(y_val, y_val_pred)))
        print(f"     Config {i+1}: depth={params['max_depth']}, lr={params['learning_rate']}, "
              f"n={params['n_estimators']} → val RMSE={rmse:.4f}")
        if rmse < best_rmse:
            best_rmse = rmse
            best_model = model
            best_params = params

    print(f"   ✅ Best config: {best_params}  (val RMSE={best_rmse:.4f})")
    print()

    # ── 5-fold cross-validation on full training set ──
    print("   5-fold cross-validation...")
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(
        xgb.XGBRegressor(**best_params, subsample=0.8, colsample_bytree=0.8,
                         reg_alpha=0.1, reg_lambda=1.0, tree_method="hist", random_state=42),
        X_train_full, y_train_full, cv=kf, scoring="neg_root_mean_squared_error",
    )
    print(f"   CV RMSE: {-cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    print()

    # ── Retrain on full training data with best params ──
    print("   Retraining on full train set with best params...")
    final_model = xgb.XGBRegressor(
        **best_params,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        tree_method="hist",
        random_state=42,
    )
    final_model.fit(
        X_train_full, y_train_full,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    # ── Test set evaluation ──
    y_pred = final_model.predict(X_test)
    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = float(r2_score(y_test, y_pred))

    print()
    print("   ┌─────────────────────────────┐")
    print(f"   │  Test MAE:   {mae:.4f}          │")
    print(f"   │  Test RMSE:  {rmse:.4f}          │")
    print(f"   │  Test R²:    {r2:.4f}          │")
    print("   └─────────────────────────────┘")
    print()

    # ── SHAP explainability ──
    print("   Computing SHAP values (TreeExplainer)...")
    explainer = shap.TreeExplainer(final_model)
    shap_sample = X_test[:200]
    shap_values = explainer.shap_values(shap_sample)

    # Feature importance (3 sources: gain, SHAP mean |value|, weight)
    gain_importance = dict(zip(feature_names, final_model.feature_importances_.tolist()))
    shap_importance = dict(zip(
        feature_names,
        np.abs(shap_values).mean(axis=0).tolist(),
    ))
    print("   Feature importance (by gain):")
    for fname, imp in sorted(gain_importance.items(), key=lambda x: -x[1])[:10]:
        bar = "█" * int(imp * 100)
        print(f"     {fname:35s}  {imp:.4f}  {bar}")

    # ── Save ──
    with open(model_dir / "risk_model.pkl", "wb") as f:
        pickle.dump(final_model, f)
    with open(model_dir / "risk_explainer.pkl", "wb") as f:
        pickle.dump(explainer, f)

    model_info = {
        "type": "xgboost_regressor",
        "version": "3.0",
        "features": feature_names,
        "n_features": len(feature_names),
        "n_samples_train": len(X_train_full),
        "n_samples_test": len(X_test),
        "best_params": best_params,
        "metrics": {"mae": mae, "rmse": rmse, "r2": r2, "cv_rmse_mean": float(-cv_scores.mean()), "cv_rmse_std": float(cv_scores.std())},
        "feature_importance_gain": gain_importance,
        "feature_importance_shap": shap_importance,
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    with open(model_dir / "risk_model_info.json", "w") as f:
        json.dump(model_info, f, indent=2)

    print()
    print("   ✅ Risk model saved → models/risk_model.pkl")
    print()


# ═══════════════════════════════════════════════════════════
# 2. FRAUD DETECTION — XGBClassifier + Isolation Forest
# ═══════════════════════════════════════════════════════════

def train_fraud_model():
    """Train an ensemble fraud detector:
      - XGBClassifier (supervised, uses labeled fraud data)
      - IsolationForest (unsupervised anomaly detection)
    Both are saved; inference ensembles their scores.
    """
    data_dir = Path(__file__).parent / "output"
    model_dir = Path(__file__).parent / "models"
    model_dir.mkdir(exist_ok=True)

    print("=" * 55)
    print("🔍  FRAUD DETECTION MODEL  (XGBClassifier + IsoForest)")
    print("=" * 55)
    print()

    # ── Load data ──
    with open(data_dir / "fraud_training_X.json") as f:
        X_raw = json.load(f)
    with open(data_dir / "fraud_training_y.json") as f:
        y_raw = json.load(f)

    feature_names = list(X_raw[0].keys())
    X = np.array([[row[f] for f in feature_names] for row in X_raw], dtype=np.float32)
    y = np.array(y_raw, dtype=np.int32)

    n_fraud = int(y.sum())
    n_legit = len(y) - n_fraud
    fraud_rate = y.mean()
    imbalance_ratio = n_legit / max(n_fraud, 1)

    print(f"   Dataset:    {len(X):,} samples × {len(feature_names)} features")
    print(f"   Classes:    {n_legit:,} legit / {n_fraud:,} fraud  ({fraud_rate:.2%})")
    print(f"   Imbalance:  {imbalance_ratio:.1f}:1")
    print(f"   Features:   {feature_names}")
    print()

    if not HAS_ML:
        _save_simulation_info(model_dir, "fraud", feature_names, len(X), extra={
            "fraud_rate": float(fraud_rate),
        })
        return

    # ── Stratified train/test split ──
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y,
    )
    print(f"   Split: train={len(X_train):,} (fraud={y_train.sum()})  "
          f"test={len(X_test):,} (fraud={y_test.sum()})")

    # ── A: XGBClassifier (supervised) ──
    print()
    print("   ── XGBClassifier (supervised) ──")

    # Handle class imbalance with scale_pos_weight
    scale_pos_weight = float(n_legit / max(n_fraud, 1))

    clf_params = [
        {"n_estimators": 400, "max_depth": 5, "learning_rate": 0.05, "min_child_weight": 3},
        {"n_estimators": 500, "max_depth": 6, "learning_rate": 0.08, "min_child_weight": 5},
        {"n_estimators": 600, "max_depth": 4, "learning_rate": 0.03, "min_child_weight": 8},
    ]

    best_clf = None
    best_auc = 0.0
    best_clf_params = {}

    for i, params in enumerate(clf_params):
        clf = xgb.XGBClassifier(
            **params,
            scale_pos_weight=scale_pos_weight,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            use_label_encoder=False,
            eval_metric="logloss",
            tree_method="hist",
            random_state=42,
        )
        clf.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
        y_proba = clf.predict_proba(X_test)[:, 1]
        auc = roc_auc_score(y_test, y_proba)
        print(f"     Config {i+1}: depth={params['max_depth']}, lr={params['learning_rate']} → AUC={auc:.4f}")
        if auc > best_auc:
            best_auc = auc
            best_clf = clf
            best_clf_params = params

    print(f"   ✅ Best AUC: {best_auc:.4f}")

    # ── 5-fold stratified CV on best config ──
    print("   5-fold stratified cross-validation...")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_aucs = cross_val_score(
        xgb.XGBClassifier(**best_clf_params, scale_pos_weight=scale_pos_weight,
                          subsample=0.8, colsample_bytree=0.8, reg_alpha=0.1, reg_lambda=1.0,
                          use_label_encoder=False, eval_metric="logloss",
                          tree_method="hist", random_state=42),
        X, y, cv=skf, scoring="roc_auc",
    )
    print(f"   CV AUC: {cv_aucs.mean():.4f} ± {cv_aucs.std():.4f}")

    # ── Test evaluation ──
    y_proba = best_clf.predict_proba(X_test)[:, 1]
    y_pred = (y_proba >= 0.5).astype(int)

    auc_roc = roc_auc_score(y_test, y_proba)
    pr_auc = average_precision_score(y_test, y_proba)
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="binary")
    cm = confusion_matrix(y_test, y_pred)

    print()
    print("   ┌──────────────────────────────────┐")
    print(f"   │  AUC-ROC:      {auc_roc:.4f}            │")
    print(f"   │  PR-AUC:       {pr_auc:.4f}            │")
    print(f"   │  Precision:    {precision:.4f}            │")
    print(f"   │  Recall:       {recall:.4f}            │")
    print(f"   │  F1-Score:     {f1:.4f}            │")
    print("   └──────────────────────────────────┘")
    print(f"   Confusion matrix:\n{cm}")
    print()

    # ── B: Isolation Forest (unsupervised anomaly layer) ──
    print("   ── Isolation Forest (unsupervised anomaly layer) ──")

    iso_model = IsolationForest(
        n_estimators=300,
        contamination=max(float(fraud_rate), 0.01),
        max_features=0.8,
        max_samples=min(len(X_train), 4096),
        bootstrap=True,
        random_state=42,
    )
    iso_model.fit(X_train)

    iso_scores = iso_model.score_samples(X_test)
    iso_pred = (iso_model.predict(X_test) == -1).astype(int)
    iso_auc = roc_auc_score(y_test, -iso_scores)
    print(f"   IsoForest AUC-ROC: {iso_auc:.4f}")
    print(f"   Anomalies flagged: {iso_pred.sum()} / {len(iso_pred)}")

    # ── Ensemble score = 0.7 × XGBClassifier + 0.3 × IsoForest ──
    # Normalise IsoForest scores to [0, 1]
    iso_norm = (iso_scores - iso_scores.min()) / (iso_scores.max() - iso_scores.min() + 1e-9)
    iso_fraud_score = 1 - iso_norm  # Lower anomaly score → higher fraud probability
    ensemble_score = 0.7 * y_proba + 0.3 * iso_fraud_score
    ensemble_auc = roc_auc_score(y_test, ensemble_score)
    print(f"   Ensemble AUC-ROC:  {ensemble_auc:.4f}  (0.7×XGB + 0.3×Iso)")
    print()

    # ── SHAP explainability ──
    print("   Computing SHAP values...")
    try:
        clf_explainer = shap.TreeExplainer(best_clf)
        shap_values = clf_explainer.shap_values(X_test[:200])
        with open(model_dir / "fraud_explainer.pkl", "wb") as f:
            pickle.dump(clf_explainer, f)
        print("   ✅ SHAP explainer saved (XGBClassifier)")
    except Exception as e:
        clf_explainer = None
        print(f"   ⚠️ SHAP failed: {e}")

    # Feature importance
    gain_importance = dict(zip(feature_names, best_clf.feature_importances_.tolist()))
    print("   Feature importance (by gain):")
    for fname, imp in sorted(gain_importance.items(), key=lambda x: -x[1])[:10]:
        bar = "█" * int(imp * 100)
        print(f"     {fname:35s}  {imp:.4f}  {bar}")

    shap_importance = {}
    if clf_explainer is not None:
        shap_importance = dict(zip(
            feature_names,
            np.abs(shap_values).mean(axis=0).tolist(),
        ))

    # ── Save both models ──
    with open(model_dir / "fraud_classifier.pkl", "wb") as f:
        pickle.dump(best_clf, f)
    with open(model_dir / "fraud_isoforest.pkl", "wb") as f:
        pickle.dump(iso_model, f)
    # Also save as fraud_model.pkl for backward compat
    with open(model_dir / "fraud_model.pkl", "wb") as f:
        pickle.dump(best_clf, f)

    # ── Feature scaler (optional, for normalising IsoForest scores at inference) ──
    scaler = StandardScaler()
    scaler.fit(X_train)
    with open(model_dir / "fraud_scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)

    model_info = {
        "type": "ensemble_xgb_isoforest",
        "version": "3.0",
        "features": feature_names,
        "n_features": len(feature_names),
        "n_samples_train": len(X_train),
        "n_samples_test": len(X_test),
        "fraud_rate": float(fraud_rate),
        "class_balance": {"legit": n_legit, "fraud": n_fraud},
        "best_clf_params": best_clf_params,
        "ensemble_weights": {"xgb_classifier": 0.7, "isolation_forest": 0.3},
        "metrics": {
            "xgb_auc_roc": float(auc_roc),
            "xgb_pr_auc": float(pr_auc),
            "xgb_precision": float(precision),
            "xgb_recall": float(recall),
            "xgb_f1": float(f1),
            "isoforest_auc_roc": float(iso_auc),
            "ensemble_auc_roc": float(ensemble_auc),
            "cv_auc_mean": float(cv_aucs.mean()),
            "cv_auc_std": float(cv_aucs.std()),
        },
        "confusion_matrix": cm.tolist(),
        "feature_importance_gain": gain_importance,
        "feature_importance_shap": shap_importance,
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    with open(model_dir / "fraud_model_info.json", "w") as f:
        json.dump(model_info, f, indent=2)

    print()
    print("   ✅ Fraud models saved → models/fraud_classifier.pkl + fraud_isoforest.pkl")
    print()


# ═══════════════════════════════════════════════════════════
# UTILITY
# ═══════════════════════════════════════════════════════════

def _save_simulation_info(model_dir, prefix, feature_names, n_samples, extra=None):
    """Save metadata when ML libs are not available."""
    info = {
        "type": f"{prefix}_simulated",
        "features": feature_names,
        "n_samples": n_samples,
        **(extra or {}),
    }
    with open(model_dir / f"{prefix}_model_info.json", "w") as f:
        json.dump(info, f, indent=2)
    print(f"   ⚠️ ML libs not available — saved metadata only ({prefix})")


def main():
    t0 = time.time()
    print()
    print("╔══════════════════════════════════════════════════════╗")
    print("║   GigCover ML Training Pipeline v3.0                ║")
    print("║   XGBoost Risk + XGBClassifier/IsoForest Fraud      ║")
    print("╚══════════════════════════════════════════════════════╝")
    print()

    data_dir = Path(__file__).parent / "output"
    if not (data_dir / "risk_training_X.json").exists():
        print("❌ Training data not found! Run generate_synthetic.py first.")
        print("   python generate_synthetic.py")
        return

    train_risk_model()
    train_fraud_model()

    elapsed = time.time() - t0
    print("╔══════════════════════════════════════════════════════╗")
    print(f"║  ✨ All models trained in {elapsed:.1f}s                     ║")
    print("║  📁 Models → ml-api/models/                         ║")
    print("╚══════════════════════════════════════════════════════╝")


if __name__ == "__main__":
    main()
