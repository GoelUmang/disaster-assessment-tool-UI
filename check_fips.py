import pandas as pd

def main():
    # 1) Load data_features.csv and get unique FIPS
    df_features = pd.read_csv("data_features.csv", dtype={"FIPS": str})
    unique_fips_features = pd.unique(df_features["FIPS"].astype(str))
    unique_fips_features.sort()

    # 2) Load instance_necessity_scores.csv and get unique FIPS
    df_nec = pd.read_csv("importance_scores_v4b/instance_necessity_scores.csv", dtype={"FIPS": str})
    unique_fips_nec = pd.unique(df_nec["FIPS"].astype(str))
    unique_fips_nec.sort()

    # 3) Compute intersection (matching FIPS)
    matching_fips = sorted(set(unique_fips_features).intersection(unique_fips_nec))

    # 4) Print results
    print(f"Unique FIPS in data_features.csv ({len(unique_fips_features)}):")
    print(unique_fips_features.tolist())
    print("\n" + "-"*80 + "\n")

    print(f"Unique FIPS in instance_necessity_scores.csv ({len(unique_fips_nec)}):")
    print(unique_fips_nec.tolist())
    print("\n" + "-"*80 + "\n")

    print(f"Matching FIPS in both files ({len(matching_fips)}):")
    print(matching_fips)

if __name__ == "__main__":
    main()
