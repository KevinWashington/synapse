// Local presentation only; semantic metadata and field requirements come from the API.
const FRAMEWORK_STYLES = {
PICO: {
    color: "var(--syn-badge-medium-bg)",
    textColor: "var(--syn-badge-medium-text)",
    badgeBg: "#dbeafe",
    badgeText: "#1e40af",
},
PICOS: {
    color: "var(--syn-badge-high-bg)",
    textColor: "var(--syn-badge-high-text)",
    badgeBg: "#fce7f3",
    badgeText: "#9d174d",
},
PECO: {
    color: "var(--syn-badge-low-bg)",
    textColor: "var(--syn-badge-low-text)",
    badgeBg: "#d1fae5",
    badgeText: "#065f46",
},
PICOC: {
    color: "var(--syn-badge-info-bg)",
    textColor: "var(--syn-badge-info-text)",
    badgeBg: "#ede9fe",
    badgeText: "#5b21b6",
},
};
const FALLBACK_STYLE = { badgeBg: "#edf0f7", badgeText: "#56627f" };
export function getComponentsForFramework(framework, catalog = []) {
  return catalog.find((item) => item.name === framework)?.components || [];
}
export function getFrameworkInfo(framework, catalog = []) {
  return { ...FALLBACK_STYLE, ...FRAMEWORK_STYLES[framework], name: framework, recommendedAreas: [], ...catalog.find((item) => item.name === framework) };
}
export function getRequiredKeys(framework, catalog = []) {
  return getComponentsForFramework(framework, catalog).filter((item) => item.required).map((item) => item.key);
}
export const TARGET_DATABASES = [
  { value: "scopus", label: "Scopus" },
  { value: "web_of_science", label: "Web of Science" },
  { value: "ieee", label: "IEEE Xplore" },
];
