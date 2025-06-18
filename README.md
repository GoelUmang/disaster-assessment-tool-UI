# An Interventional Approach to Real-Time Disaster Assessment via Causal Attribution

This repository contains the code and demo for our work:
**"An Interventional Approach to Real-Time Disaster Assessment via Causal Attribution"**
Authored by Saketh Vishnubhatla, Alimohammad Beigi, Rui Heng Foo, Umang Goel, Ujun Jeong, Bohan Jiang, Adrienne Raglin, and Huan Liu.

## Overview

Traditional disaster severity estimation systems are predictive in nature and not designed for interventional analysis or causal reasoning. Our tool offers:

* **Causal attribution of feature, feature-group, source contributions**
* **Interactive interventions (do-calculus) on structural causal models (SCMs)**
* **Algorithmic recourse via counterfactual explanations**

By leveraging real-world data sources—remote sensing, news articles, and social media posts—we model disaster severity across U.S. counties and enable actionable insights for mitigation planning.

---

## Features

### Interventions and Simulations

Simulate “what-if” scenarios using learned SCMs and toggle feature values interactively to observe their effect on severity predictions.

### Causal Attribution Scores

Visualize necessity and sufficiency of individual features, feature groups (e.g., infrastructure, vegetation), and data sources (e.g., Reddit, News, Remote Sensing).

### Algorithmic Recourse

Generate actionable changes to shift a county's current severity category (e.g., High → Low), using counterfactual explanations via [DiCE](https://github.com/interpretml/DiCE).

---

## Dataset

We curated a multimodal dataset covering:

* **867 U.S. counties**
* **9 billion-dollar disasters (2017)**
* **1097 event–county pairs**

| Source                         | Features Extracted                                                    |
| ------------------------------ | --------------------------------------------------------------------- |
| Remote Sensing (Dynamic World) | Land cover transitions (e.g., `t_trees_to_water`, `t_built_to_grass`) |
| News (Google News)             | Mentions of power lines, roofs, bridges, roads, etc.                  |
| Reddit (Pushshift API)         | Crowd-reported infrastructure, vegetation, and mobility issues        |

Severity ground-truth labels are derived from the SHELDUS database and categorized into:

* Low (< \$10K)
* Medium (\$10K–\$100K)
* High (> \$100K)

---

## Causal DAGs

We provide three structural causal graphs (DAGs):

1. **Independent Effects** — Each feature group affects severity independently.
2. **Infrastructure Mediator** — Floods and vegetation loss mediate through infrastructure to affect mobility.
3. **Flood-Driven DAG** — Floods as the primary cause leading to other damages.

---

## Models

| Model Variant | Architecture | DAG Used | Macro-F1 |
| ------------- | ------------ | -------- | -------- |
| MLP-5Layer    | (256→16)     | DAG 1    | 0.54     |
| SCM-RF        | RF per node  | DAG 2    | 0.45     |
| SCM-RF        | RF per node  | DAG 3    | 0.42     |

We use the best-performing models for simulation and recourse generation.

---

## Running the Demo Locally

### 1. Clone the repository

```bash
git clone https://github.com/GoelUmang/Disaster_bench_dashboard.git
cd Disaster_bench_dashboard
```

### 2. Install requirements

```bash
pip install -r requirements.txt
```

### 3. Run the Flask app

```bash
python generate_counterfactuals.py
```

Visit `http://127.0.0.1:5000` in your browser.

---

## Navigation

| Page             | Description                                                 |
| ---------------- | ----------------------------------------------------------- |
| **Simulation**   | Select a county and perform interventions on input features |
| **Attributions** | View most necessary features by source/group for any county |
| **Recourse**     | Choose a desired outcome and get feature recommendations    |

---

## Repo Structure

```
├── data/                       # Processed disaster data and feature sets
├── models/                     # Trained MLPs and SCM modules
├── static/                     # D3.js scripts and visual assets
├── templates/                  # HTML templates for the web UI
├── utils/                      # Helpers for SCM inference, counterfactuals, attribution
├── generate_counterfactuals.py # Flask application entry point
└── requirements.txt            # Python dependencies
```


## Contact

For questions or feedback, reach out to [svishnu6@asu.edu](mailto:svishnu6@asu.edu) or open an issue in this repo.

---

Let me know if you'd like this README saved to a file or updated to reflect specific implementation details from your GitHub repo.

