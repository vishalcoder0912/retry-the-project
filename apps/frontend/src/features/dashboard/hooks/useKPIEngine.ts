import { useEffect,useMemo } from "react";
import type { Dataset,KPI } from "@/features/data/model/dataStore";
import { buildAnalyticsDashboard } from "@/features/data/model/analyticsEngine";

type SnapshotMetricKey =
  | "dataQuality"
  | "avgSalary"
  | "correlation"
  | "educationImpact";

interface KPISnapshot {
  datasetId:string;
  timestamp:number;
  metrics:Record<SnapshotMetricKey,number | null>;
}

const STORAGE_PREFIX = "insightflow-kpi-snapshot";
const TREND_EPSILON = 0.5;
const EDUCATION_ORDER = ["High School","Diploma","Associate","Bachelor","Master","MBA","PhD"];

const roundTo = (value:number,decimals:number=2)=>{
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const formatCurrencyCompact = (value:number)=>new Intl.NumberFormat("en-US",{
  style:"currency",
  currency:"USD",
  notation:"compact",
  maximumFractionDigits:1,
}).format(value);

const normalizeEducationRank = (value:string)=>{
  const lower = value.toLowerCase();
  if (lower.includes("phd") || lower.includes("doctor")) return 6;
  if (lower.includes("mba")) return 5;
  if (lower.includes("master")) return 4;
  if (lower.includes("bachelor")) return 3;
  if (lower.includes("associate")) return 2;
  if (lower.includes("diploma")) return 1;
  return 0;
};

const readSnapshot = (datasetId:string)=>{
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}:${datasetId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as KPISnapshot;
  } catch {
    return null;
  }
};

const writeSnapshot = (snapshot:KPISnapshot)=>{
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`${STORAGE_PREFIX}:${snapshot.datasetId}`,JSON.stringify(snapshot));
};

const computeChange = (current:number | null,previous:number | null)=>{
  if (current == null || previous == null || previous === 0) return undefined;
  return roundTo(((current - previous) / previous) * 100,2);
};

const deriveTrend = (change:number | undefined):"up"|"down"|"stable"=>{
  if (change == null || Math.abs(change) <= TREND_EPSILON) return "stable";
  return change > 0 ? "up" : "down";
};

const buildSparkline = (previous:number | null,current:number | null,fallback:number[])=>{
  const values = [previous,current].filter((value):value is number=>value != null);
  if (values.length >= 2) return values;
  return fallback.length > 1 ? fallback : (current != null ? [current,current,current] : [0,0,0]);
};

const correlationCoefficient = (pairs:Array<{ x:number; y:number }>)=>{
  if (pairs.length < 2) return null;
  const xValues = pairs.map((pair)=>pair.x);
  const yValues = pairs.map((pair)=>pair.y);
  const xMean = xValues.reduce((sum,value)=>sum + value,0) / xValues.length;
  const yMean = yValues.reduce((sum,value)=>sum + value,0) / yValues.length;

  let numerator = 0;
  let xVariance = 0;
  let yVariance = 0;

  pairs.forEach(({ x,y })=>{
    const xDelta = x - xMean;
    const yDelta = y - yMean;
    numerator += xDelta * yDelta;
    xVariance += xDelta ** 2;
    yVariance += yDelta ** 2;
  });

  const denominator = Math.sqrt(xVariance * yVariance);
  if (!denominator) return null;
  return roundTo(numerator / denominator,2);
};

const correlationInsight = (value:number | null)=>{
  if (value == null) return "Correlation is unavailable because the dataset lacks enough valid salary and experience pairs.";
  if (value >= 0.7) return "Strong positive correlation between experience and salary.";
  if (value >= 0.4) return "Moderate positive correlation suggests salary generally rises with experience.";
  if (value > 0) return "Weak positive correlation indicates other factors besides experience drive salary outcomes.";
  if (value <= -0.4) return "Negative correlation suggests the salary pattern may be distorted by role mix or sparse observations.";
  return "No meaningful linear relationship was detected between experience and salary.";
};

const educationLabelSort = (entries:Array<Record<string,string|number>>,key:string)=>{
  return [...entries].sort((left,right)=>{
    const leftLabel = String(left[key]);
    const rightLabel = String(right[key]);
    const leftRank = normalizeEducationRank(leftLabel);
    const rightRank = normalizeEducationRank(rightLabel);
    if (leftRank !== rightRank) return leftRank - rightRank;
    const leftIndex = EDUCATION_ORDER.indexOf(leftLabel);
    const rightIndex = EDUCATION_ORDER.indexOf(rightLabel);
    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    return leftLabel.localeCompare(rightLabel);
  });
};

const buildKPI = ({
  title,
  value,
  change,
  status,
  insight,
  icon,
  sparkline,
}:{
  title:string;
  value:string;
  change?:number;
  status:"good"|"warning"|"critical";
  insight:string;
  icon:string;
  sparkline:number[];
}):KPI=>({
  title,
  value,
  change,
  trend:deriveTrend(change),
  status,
  insight,
  icon,
  sparkline,
});

export const useKPIEngine = (data:Dataset | null)=>{
  const analyticsBundle = useMemo(()=>data ? buildAnalyticsDashboard(data) : null,[data]);
  const previousSnapshot = useMemo(()=>data ? readSnapshot(data.id) : null,[data]);

  const kpis = useMemo(()=>{
    if (!data || !analyticsBundle) return [] as KPI[];

    const salaryByCountry = analyticsBundle.structuredData.salaryByCountry;
    const experienceSalaryScatter = analyticsBundle.structuredData.experienceSalaryScatter;
    const languageData = analyticsBundle.structuredData.languages;
    const educationData = analyticsBundle.structuredData.salaryByEducation;
    const dataQualityValue = analyticsBundle.health.metrics.integrityScore;
    const avgSalaryValue = salaryByCountry.length > 0
      ? roundTo(salaryByCountry.reduce((sum,entry)=>sum + Number(entry.salary_usd ?? 0),0) / salaryByCountry.length,2)
      : null;
    const correlationValue = correlationCoefficient(
      experienceSalaryScatter.map((entry)=>({
        x:Number(entry.experience ?? 0),
        y:Number(entry.salary_usd ?? 0),
      })),
    );
    const topCountry = salaryByCountry[0] ?? null;
    const topLanguage = languageData[0] ?? null;
    const orderedEducation = educationLabelSort(educationData,"education");
    const lowestEducation = orderedEducation[0] ?? null;
    const highestEducation = orderedEducation[orderedEducation.length - 1] ?? null;
    const educationImpactValue = lowestEducation && highestEducation && Number(lowestEducation.salary_usd ?? 0) > 0
      ? roundTo(((Number(highestEducation.salary_usd ?? 0) - Number(lowestEducation.salary_usd ?? 0)) / Number(lowestEducation.salary_usd)) * 100,2)
      : null;

    const snapshotMetrics:Record<SnapshotMetricKey,number | null> = {
      dataQuality:dataQualityValue,
      avgSalary:avgSalaryValue,
      correlation:correlationValue,
      educationImpact:educationImpactValue,
    };

    const dataQualityChange = computeChange(snapshotMetrics.dataQuality,previousSnapshot?.metrics.dataQuality ?? null);
    const avgSalaryChange = computeChange(snapshotMetrics.avgSalary,previousSnapshot?.metrics.avgSalary ?? null);
    const correlationChange = computeChange(snapshotMetrics.correlation,previousSnapshot?.metrics.correlation ?? null);
    const educationImpactChange = computeChange(snapshotMetrics.educationImpact,previousSnapshot?.metrics.educationImpact ?? null);

    return [
      buildKPI({
        title:"Data Quality",
        value:`${dataQualityValue.toFixed(2)}%`,
        change:dataQualityChange,
        status:dataQualityValue >= 90 ? "good" : dataQualityValue >= 75 ? "warning" : "critical",
        insight:dataQualityValue >= 90
          ? "High data integrity with minimal missing values."
          : dataQualityValue >= 75
          ? "Quality is usable but missing values or exclusions still affect downstream analysis."
          : "Data quality is weak and can materially distort analysis outputs.",
        icon:"shield",
        sparkline:buildSparkline(previousSnapshot?.metrics.dataQuality ?? null,dataQualityValue,[analyticsBundle.validationSummary.totalRows,analyticsBundle.validationSummary.validRows]),
      }),
      buildKPI({
        title:"Avg Salary",
        value:avgSalaryValue != null ? formatCurrencyCompact(avgSalaryValue) : "N/A",
        change:avgSalaryChange,
        status:avgSalaryValue != null && avgSalaryValue >= 100000 ? "good" : avgSalaryValue != null && avgSalaryValue >= 60000 ? "warning" : "critical",
        insight:avgSalaryValue != null
          ? avgSalaryChange != null
            ? `Average salary is ${formatCurrencyCompact(avgSalaryValue)} with a ${Math.abs(avgSalaryChange).toFixed(2)}% ${avgSalaryChange >= 0 ? "increase" : "decline"} versus the previous snapshot.`
            : `Average salary currently sits at ${formatCurrencyCompact(avgSalaryValue)} across valid salary records.`
          : "Average salary is unavailable because the dataset lacks valid salary values.",
        icon:"dollar",
        sparkline:buildSparkline(previousSnapshot?.metrics.avgSalary ?? null,avgSalaryValue,salaryByCountry.slice(0,5).map((entry)=>Number(entry.salary_usd ?? 0))),
      }),
      buildKPI({
        title:"Experience-Salary Correlation",
        value:correlationValue != null ? correlationValue.toFixed(2) : "N/A",
        change:correlationChange,
        status:correlationValue != null && correlationValue >= 0.6 ? "good" : correlationValue != null && correlationValue >= 0.3 ? "warning" : "critical",
        insight:correlationInsight(correlationValue),
        icon:"chart",
        sparkline:buildSparkline(previousSnapshot?.metrics.correlation ?? null,correlationValue,experienceSalaryScatter.slice(0,8).map((entry)=>Number(entry.salary_usd ?? 0))),
      }),
      buildKPI({
        title:"Top Country",
        value:topCountry ? String(topCountry.country ?? "N/A") : "N/A",
        status:topCountry && Number(topCountry.normalizedValue ?? 0) >= 10000 ? "good" : topCountry ? "warning" : "critical",
        insight:topCountry
          ? `${String(topCountry.country)} leads average salary at ${formatCurrencyCompact(Number(topCountry.salary_usd ?? 0))}${Number(topCountry.sampleSize ?? 0) < 3 ? ", though the sample size is limited." : "."}`
          : "No country-level salary comparison is available.",
        icon:"columns",
        sparkline:salaryByCountry.slice(0,6).map((entry)=>Number(entry.salary_usd ?? 0)),
      }),
      buildKPI({
        title:"Most Popular Language",
        value:topLanguage ? String(topLanguage.languages ?? "N/A") : "N/A",
        status:topLanguage && Number(topLanguage.percentage ?? 0) >= 30 ? "good" : topLanguage && Number(topLanguage.percentage ?? 0) >= 15 ? "warning" : "critical",
        insight:topLanguage
          ? `${String(topLanguage.languages)} dominates usage with ${Number(topLanguage.percentage ?? 0).toFixed(1)}% of all parsed language mentions.`
          : "No language field was detected for popularity analysis.",
        icon:"package",
        sparkline:languageData.slice(0,6).map((entry)=>Number(entry.count ?? 0)),
      }),
      buildKPI({
        title:"Education Impact",
        value:educationImpactValue != null ? `${educationImpactValue.toFixed(2)}%` : "N/A",
        change:educationImpactChange,
        status:educationImpactValue != null && educationImpactValue >= 40 ? "good" : educationImpactValue != null && educationImpactValue >= 15 ? "warning" : "critical",
        insight:educationImpactValue != null && lowestEducation && highestEducation
          ? `Salary rises ${educationImpactValue.toFixed(2)}% from ${String(lowestEducation.education)} to ${String(highestEducation.education)}.`
          : "Education impact is unavailable because education and salary coverage is incomplete.",
        icon:"percent",
        sparkline:orderedEducation.map((entry)=>Number(entry.salary_usd ?? 0)),
      }),
    ];
  },[analyticsBundle,data,previousSnapshot]);

  useEffect(()=>{
    if (!data || !analyticsBundle) return;

    const salaryByCountry = analyticsBundle.structuredData.salaryByCountry;
    const experienceSalaryScatter = analyticsBundle.structuredData.experienceSalaryScatter;
    const educationData = educationLabelSort(analyticsBundle.structuredData.salaryByEducation,"education");
    const lowestEducation = educationData[0] ?? null;
    const highestEducation = educationData[educationData.length - 1] ?? null;
    const avgSalary = salaryByCountry.length > 0
      ? roundTo(salaryByCountry.reduce((sum,entry)=>sum + Number(entry.salary_usd ?? 0),0) / salaryByCountry.length,2)
      : null;
    const correlation = correlationCoefficient(
      experienceSalaryScatter.map((entry)=>({
        x:Number(entry.experience ?? 0),
        y:Number(entry.salary_usd ?? 0),
      })),
    );
    const educationImpact = lowestEducation && highestEducation && Number(lowestEducation.salary_usd ?? 0) > 0
      ? roundTo(((Number(highestEducation.salary_usd ?? 0) - Number(lowestEducation.salary_usd ?? 0)) / Number(lowestEducation.salary_usd)) * 100,2)
      : null;

    writeSnapshot({
      datasetId:data.id,
      timestamp:Date.now(),
      metrics:{
        dataQuality:analyticsBundle.health.metrics.integrityScore,
        avgSalary,
        correlation,
        educationImpact,
      },
    });
  },[analyticsBundle,data]);

  return useMemo(()=>({
    kpis,
    analyticsBundle,
  }),[analyticsBundle,kpis]);
};
