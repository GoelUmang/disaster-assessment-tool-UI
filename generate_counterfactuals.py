# File name: generate_counterfactuals.py
# File description: runs model with dict as inputs

# TODO: convert this to a Flask Backend API

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import traceback
import os
import json
import joblib
import numpy as np
import pandas as pd
from collections import defaultdict
from sklearn.metrics import accuracy_score, f1_score
from sklearn.preprocessing import LabelEncoder, RobustScaler

# ------------------ CONFIG ------------------ #
DATA_PATH = "./data_features.csv"
GROUPINGS_PATH = "./models/disaster-assessment-tool/assets/groupings/feature_groupings.csv"
DAG_PATH = "./models/disaster-assessment-tool/assets/dags/dag_structures.json"
OUTPUT_BASE = "./models/disaster-assessment-tool/assets/full_features_v6"
TARGET_COL = "Property_Damage_GT"

# ------------------ DAG HELPERS ------------------ #
def expand_group_dag_to_parents(dag_json, groupings, target_col):
    group_to_features = defaultdict(list)
    for _, row in groupings.iterrows():
        group_to_features[row["Group"]].append(row["Feature"])

    dag_parents = defaultdict(list)
    for src_group, tgt_groups in dag_json.items():
        src_feats = group_to_features.get(src_group, [])
        for tgt_group in tgt_groups:
            tgt_feats = group_to_features.get(tgt_group, [])
            for tgt_feat in tgt_feats:
                dag_parents[tgt_feat].extend(src_feats)

    dag_parents.setdefault(target_col, [])
    for src_group, tgt_groups in dag_json.items():
        if target_col in tgt_groups:
            dag_parents[target_col].extend(group_to_features.get(src_group, []))

    for node in dag_parents:
        dag_parents[node] = list(set(dag_parents[node]))

    return dag_parents

def topological_sort(parents_dict):
    all_nodes = set(parents_dict.keys()) | {p for ps in parents_dict.values() for p in ps}
    in_deg = {node: 0 for node in all_nodes}
    for child, parents in parents_dict.items():
        for parent in parents:
            in_deg[child] += 1

    queue = [node for node, deg in in_deg.items() if deg == 0]
    sorted_nodes = []

    while queue:
        node = queue.pop(0)
        sorted_nodes.append(node)
        for child, parents in parents_dict.items():
            if node in parents:
                in_deg[child] -= 1
                if in_deg[child] == 0:
                    queue.append(child)

    return [n for n in sorted_nodes if n in parents_dict or n == TARGET_COL]

# ------------------ MODEL LOADING ------------------ #
def load_scm_components(model_dir):
    models, configs, epsilons = {}, {}, {}
    for file in os.listdir(os.path.join(model_dir, "models")):
        if file.endswith(".joblib") and file != "scaler.joblib":
            node = file.replace(".joblib", "")
            models[node] = joblib.load(os.path.join(model_dir, "models", file))
        elif file.endswith("_model_config.json"):
            node = file.replace("_model_config.json", "")
            with open(os.path.join(model_dir, "models", file)) as f:
                configs[node] = json.load(f)

    eps_dir = os.path.join(model_dir, "eps")
    for file in os.listdir(eps_dir):
        if file.startswith("eps_test_") and file.endswith(".npy"):
            node = file.replace("eps_test_", "").replace(".npy", "")
            epsilons[node] = np.load(os.path.join(eps_dir, file))

    scaler = joblib.load(os.path.join(model_dir, "models", "scaler.joblib"))
    return models, configs, epsilons, scaler

def predict_label(instance_df, models, configs, target_col):
    instance = instance_df.copy()
    top_order = [k for k in configs.keys()]
    top_order.sort()  # assumes proper order; replace with topological_sort if needed

    for node in top_order:
        parents = configs[node]["input_features"]
        pred = models[node].predict(instance[parents])[0]
        instance[node] = pred

    return instance[target_col].values[0]


# ------------------ INTERVENTION & CF GENERATION ------------------ #
def do_intervention(instance, interventions):
    for var, val in interventions.items():
        instance[var] = val
    return instance

def abduction_action_prediction(instance, models, epsilons, configs, top_order, interventions):
    for node in top_order:
        if node in interventions:
            continue
        parents = configs[node]["input_features"]
        pred = models[node].predict(instance[parents])[0]
        instance[node] = pred + epsilons[node][0] if node != TARGET_COL else pred
    return instance

# ------------------ MAIN FUNCTION ------------------ #
def run_scm_counterfactual_simulation(original_sample, interventions_raw, dag_key, dag_path=DAG_PATH):
    input_features = ['Num_News', 'Num_Reddit', 'News_Trees', 'Reddit_Trees', 'News_Power Lines', 'Reddit_Power Lines', 'News_Roofs', 'Reddit_Roofs', 'News_Buildings', 'Reddit_Buildings', 'News_Vehicles', 'Reddit_Vehicles', 'News_Agriculture', 'Reddit_Agriculture', 'News_Infrastructure', 'Reddit_Infrastructure', 'transition_0_0', 'transition_0_1', 'transition_0_2', 'transition_0_3', 'transition_0_4', 'transition_0_5', 'transition_0_6', 'transition_0_7', 'transition_0_8', 'transition_1_0', 'transition_1_1', 'transition_1_2', 'transition_1_3', 'transition_1_4', 'transition_1_5', 'transition_1_6', 'transition_1_7', 'transition_1_8', 'transition_2_0', 'transition_2_1', 'transition_2_2', 'transition_2_3', 'transition_2_4', 'transition_2_5', 'transition_2_6', 'transition_2_7', 'transition_2_8', 'transition_3_0', 'transition_3_1', 'transition_3_2', 'transition_3_3', 'transition_3_4', 'transition_3_5', 'transition_3_6', 'transition_3_7', 'transition_3_8', 'transition_4_0', 'transition_4_1', 'transition_4_2', 'transition_4_3', 'transition_4_4', 'transition_4_5', 'transition_4_6', 'transition_4_7', 'transition_4_8', 'transition_5_0', 'transition_5_1', 'transition_5_2', 'transition_5_3', 'transition_5_4', 'transition_5_5', 'transition_5_6', 'transition_5_7', 'transition_5_8', 'transition_6_0', 'transition_6_1', 'transition_6_2', 'transition_6_3', 'transition_6_4', 'transition_6_5', 'transition_6_6', 'transition_6_7', 'transition_6_8', 'transition_7_0', 'transition_7_1', 'transition_7_2', 'transition_7_3', 'transition_7_4', 'transition_7_5', 'transition_7_6', 'transition_7_7', 'transition_7_8', 'transition_8_0', 'transition_8_1', 'transition_8_2', 'transition_8_3', 'transition_8_4', 'transition_8_5', 'transition_8_6', 'transition_8_7', 'transition_8_8']

    label_encoder = LabelEncoder()
    label_encoder.classes_ = np.array(["High", "Low", "Medium"])
   
    model_dir = os.path.join(OUTPUT_BASE, f"scm_{dag_key.lower()}")

    models, configs, epsilons, scaler = load_scm_components(model_dir)
    top_order = topological_sort({k: v["input_features"] for k, v in configs.items()})

    original = pd.DataFrame([original_sample])
    scaled_input = original[input_features].copy()
    scaled_input[input_features] = scaler.transform(scaled_input[input_features])

    # print("--- Original Unscaled Feature Values ---")
    # for var in interventions_raw:
    #     print(f"{var}: {original[var].values[0]}")

    # print("\n--- Raw Intervention Values ---")
    # for k, v in interventions_raw.items():
    #     print(f"{k}: new_value={v:.2f}")

    scaled_interventions = {}
    temp = original[input_features].copy()

    # Apply raw (unscaled) intervention values
    for var, new_val in interventions_raw.items():
        temp[var] = new_val

    # Scale the entire row
    temp[input_features] = scaler.transform(temp[input_features])

    # Extract the scaled values for the intervened variables
    for var in interventions_raw:
        scaled_interventions[var] = temp[var].values[0]


    counterfactual = do_intervention(scaled_input.copy(), scaled_interventions)
    counterfactual = abduction_action_prediction(counterfactual, models, epsilons, configs, top_order, scaled_interventions)

    # print("\n--- Scaled Interventions Applied ---")
    # for var in scaled_interventions:
    #     print(f"{var}: original_scaled={scaled_input[var].values[0]:.4f}, new_scaled={scaled_interventions[var]:.4f}")

    label_id = predict_label(scaled_input, models, configs, TARGET_COL)
    original_label = label_encoder.inverse_transform([label_id])[0]

    counterfactual_numeric = counterfactual[TARGET_COL].values[0]
    counterfactual_label = label_encoder.inverse_transform([counterfactual_numeric])[0]

    print(f"\nOriginal Prediction: {original_label}")
    print(f"Counterfactual Prediction: {counterfactual_label}")

    return counterfactual_label, original_label

# ------------------ FLASK BACKEND API ------------------ #
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'API is running'})

@app.route('/simulate', methods=['POST'])
def run_simulation():
    
    """
    Main endpoint for running SCM counterfactual simulations
    
    Expected JSON payload:
    {
        "original_dict": {...},  # Original data dictionary
        "interventions_dict_dict": {...},  # interventions_dict dictionary
        "dag_key": dag_key # dag key set
    }
    """
    try:
        # payload = request.get_json()
        # print("📥 Backend got:", payload)
        # return jsonify(payload)  # echo it back
        # Parse JSON request
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400
        
        data = request.get_json()
        
        # Validate required fields
        if 'original_dict' not in data:
            return jsonify({'error': 'Missing required field: original_dict'}), 400
        
        if 'interventions_dict' not in data:
            return jsonify({'error': 'Missing required field: interventions_dict'}), 400
        
        # Extract parameters
        original_dict = data['original_dict']
        interventions_dict = data['interventions_dict']
        dag_key = data.get('dag_key', 'DAG_1_Independent')
        
        # Validate dag_key
        valid_dag_keys = [
            'DAG_1_Independent',
            'DAG_2_Infrastructure_Mediator', 
            'DAG_3_Flood_Driven'
        ]
        if dag_key not in valid_dag_keys:
            return jsonify({
                'error': f'Invalid dag_key. Must be one of: {valid_dag_keys}'
            }), 400
        
        logger.info(f"Running simulation with dag_key: {dag_key}")
        
        # Run your simulation function
        counterfactual_label, original_label = run_scm_counterfactual_simulation(
            original_sample=original_dict,
            interventions_raw=interventions_dict,
            dag_key=dag_key
        )
        
        # Return results
        response = {
            'success': True,
            'results': {
                'counterfactual_label': counterfactual_label,
                'original_label': original_label,
                'dag_key_used': dag_key
            }
        }
        
        logger.info("Simulation completed successfully")
        return jsonify(response)
        
    except KeyError as e:
        logger.error(f"Missing key in input data: {e}")
        return jsonify({'error': f'Missing required key: {str(e)}'}), 400
    
    except ValueError as e:
        logger.error(f"Invalid input data: {e}")
        return jsonify({'error': f'Invalid input data: {str(e)}'}), 400
    
    except Exception as e:
        logger.error(f"Simulation failed: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'error': 'Internal server error during simulation',
            'message': str(e)
        }), 500

@app.route('/simulate/batch', methods=['POST'])
def run_batch_simulation():
    """
    Endpoint for running multiple simulations in batch
    
    Expected JSON payload:
    {
        "simulations": [
            {
                "original_dict": {...},
                "interventions_dict": {...},
                "dag_key": "DAG_2_Infrastructure_Mediator"
            },
            ...
        ]
    }
    """
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400
        
        data = request.get_json()
        
        if 'simulations' not in data:
            return jsonify({'error': 'Missing required field: simulations'}), 400
        
        simulations = data['simulations']
        
        if not isinstance(simulations, list):
            return jsonify({'error': 'simulations must be a list'}), 400
        
        results = []
        
        for i, sim in enumerate(simulations):
            try:
                original_dict = sim['original_dict']
                interventions_dict = sim['interventions_dict']
                dag_key = sim.get('dag_key', 'DAG_1_Independent')
                
                counterfactual_label, original_label = run_scm_counterfactual_simulation(
                    original_sample=original_dict,
                    interventions_raw=interventions_dict,
                    dag_key=dag_key
                )
                
                results.append({
                    'index': i,
                    'success': True,
                    'counterfactual_label': counterfactual_label,
                    'original_label': original_label,
                    'dag_key_used': dag_key
                })
                
            except Exception as e:
                results.append({
                    'index': i,
                    'success': False,
                    'error': str(e)
                })
        
        return jsonify({
            'success': True,
            'results': results,
            'total_simulations': len(simulations)
        })
        
    except Exception as e:
        logger.error(f"Batch simulation failed: {str(e)}")
        return jsonify({
            'error': 'Internal server error during batch simulation',
            'message': str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'error': 'Method not allowed'}), 405

# ------------------ MAIN RUN ------------------ #
if __name__ == "__main__":
    # Development server
    app.run(debug=True, host='0.0.0.0', port=8000)

    # ------------------ USAGE EXAMPLE ------------------ #
    df = pd.read_csv(DATA_PATH, dtype={"FIPS": str})
    groupings = pd.read_csv(GROUPINGS_PATH)
    transition_cols = [c for c in df.columns if c.startswith("transition_")]
    df[transition_cols] = df[transition_cols].div(df["county_area_m2"].replace(0, np.nan), axis=0) # refer to this
    df = df.fillna(0)

    valid_feats = set(groupings["Feature"])
    input_features = [c for c in df.columns if c in valid_feats and c != TARGET_COL]
    df_model = df[input_features + [TARGET_COL]].copy()

    test_idx = np.loadtxt(os.path.join(OUTPUT_BASE, "final_test_indices.txt"), dtype=int)
    input_test = df_model.iloc[test_idx].copy()

    original = input_test.iloc[[10]].copy()

    #-----
    # example:
    original_dict = original.iloc[0].to_dict()
    interventions_dict = {
        "transition_6_0": 10,
        "transition_3_6": 10
    }   
    # run this
    run_scm_counterfactual_simulation(
        original_sample=original_dict, # transition cols should be div by county_area_m2
        interventions_raw=interventions_dict,
        dag_key="DAG_2_Infrastructure_Mediator"
        # dag_key="DAG_1_Independent"
        # dag_key="DAG_3_Flood_Driven"
    )
    # returns counterfactual_label, original_label
