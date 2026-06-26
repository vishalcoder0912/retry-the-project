type DataScienceSummaryProps = {
  profile?: {
    rowCount?: number;
    columnCount?: number;
    qualityScore?: number | string;
    measures?: string[];
    dimensions?: string[];
  };
  anomalies?: {
    summary?: {
      anomalyCount?: number;
      count?: number;
    };
    method?: string;
  };
  correlations?: {
    strongPairs?: unknown[];
  };
  model?: {
    metrics?: Record<string, number>;
    modelType?: string;
  };
};

export default function DataScienceSummaryCards({
  profile,
  anomalies,
  correlations,
  model,
}: DataScienceSummaryProps) {
  const anomalyCount = anomalies?.summary?.anomalyCount ?? anomalies?.summary?.count ?? "-";
  const modelScore = model?.metrics ? Object.values(model.metrics)[0] : null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card label="Rows" value={profile?.rowCount ?? "-"} />
      <Card label="Columns" value={profile?.columnCount ?? "-"} />
      <Card label="Quality Score" value={profile?.qualityScore ?? "-"} />
      <Card label="Anomalies" value={anomalyCount} hint={anomalies?.method ?? "auto"} />
      <Card label="Measures" value={profile?.measures?.length ?? 0} hint={(profile?.measures ?? []).slice(0, 3).join(", ")} />
      <Card label="Dimensions" value={profile?.dimensions?.length ?? 0} hint={(profile?.dimensions ?? []).slice(0, 3).join(", ")} />
      <Card label="Strong Correlations" value={correlations?.strongPairs?.length ?? 0} />
      <Card
        label="Model Score"
        value={typeof modelScore === "number" ? modelScore.toFixed(3) : "-"}
        hint={model?.modelType ?? "select target"}
      />
    </div>
  );
}
