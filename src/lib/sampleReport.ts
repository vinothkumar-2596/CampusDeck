/* A complete sample report for trying document import, and the short
   excerpts the create page uses to show how document parts map to slides. */

export const sampleReportName = "smart-campus-energy-report.md";

export const sampleReport = `# Smart Campus Energy Monitoring

A low-cost IoT system that shows each hostel block where its electricity goes, and cuts waste without cutting comfort.

Submitted by: Kaaviya R, Arun K and Divya S
Guided by: Dr. M. Priya
Department of Computer Science and Engineering
April 2026

## Abstract

Our campus spends more on electricity than on any other utility, yet nobody can say which building, floor or appliance uses it. This project fits low-cost smart meters to three hostel blocks, streams their readings to a cloud dashboard, and sends simple alerts when power is wasted. Over a six-week trial the system cut energy use by 31% and the evening peak by 24%, with no complaints from residents. The design costs under ₹40,000 per block and can be repeated across the campus.

## 1. Introduction

Electricity is the largest running cost of our campus after salaries. Hostels alone account for nearly half of the monthly bill. Most of that power is used in the evening, when students return from classes and lights, fans and water heaters all switch on together.

The campus has one meter per building. It tells the accounts office how much was spent, but not where or when. Without that detail, saving energy depends on posters and good intentions.

### 1.1 Background

Smart meters measure power every few seconds and report it over Wi-Fi. Prices have fallen below ₹1,500 per meter, which makes metering every floor affordable for the first time.

### 1.2 Motivation

The college has pledged to cut its carbon footprint by a quarter by 2030. Measuring where power goes is the first step towards that pledge.

## 2. Problem statement

Hostel blocks pay for power that nobody is using.

- Corridor lights stay on through the night
- Water heaters run for hours after the morning rush
- Faults such as a stuck relay go unnoticed for weeks
- Wardens have no data to plan maintenance

How can a hostel see, and cut, the power it wastes without making residents uncomfortable?

## 3. Objectives

- Measure power use for every floor of three hostel blocks
- Show live and historical use on a dashboard anyone can read
- Alert wardens to waste and faults within ten minutes
- Cut total energy use by at least 20% during the trial
- Keep the cost of each block under ₹40,000

## 4. Literature survey

### 4.1 Building energy dashboards

Studies of university dashboards report savings of 5 to 15% from feedback alone.

### 4.2 Low-cost IoT metering

ESP32-based meters reach accuracy within 2% of utility meters at a fraction of the price.

### 4.3 Occupancy-based control

Motion sensors in corridors cut lighting energy by up to 40% in shared buildings.

### 4.4 Behavioural nudges

Comparing floors with each other works better than reporting absolute numbers.

## 5. Methodology

1. Survey the hostel blocks
2. Install smart meters
3. Build the cloud dashboard
4. Add alerts and controls
5. Run a six-week trial

## 6. System architecture

- Sensing layer: An ESP32 meter on each floor measures current and voltage every five seconds.
- Network layer: Readings travel over the campus Wi-Fi using MQTT, with a local buffer for outages.
- Cloud layer: A time-series database stores readings and runs the waste and fault rules.
- Presentation layer: A web dashboard and a weekly email show each block its use.

## 7. Implementation

The meters were built on custom boards with a current transformer, a voltage divider and an ESP32 module. Each meter was calibrated against a reference meter before installation. Firmware sends readings every five seconds and stores up to a day of data if the network drops.

The dashboard was built as a web application that works on phones. Wardens see their block's live load, a daily chart and a list of open alerts. Students see a floor ranking that updates every evening.

- Waste rule: corridor load above 300 W between 1 am and 5 am
- Heater rule: heater circuit on for more than 90 minutes
- Fault rule: a sudden step change that persists for an hour

## 8. Results

- Energy saved: 31%
- Evening peak cut: 24%
- Alerts acted on: 87%
- Meter uptime: 98%

The largest saving came from corridor lighting, followed by water heaters. Savings held steady through the final two weeks, which suggests they are not just a novelty effect.

## 9. Comparison with existing systems

| Feature | Building meter | Commercial BMS | Our system |
| --- | --- | --- | --- |
| Detail | Whole building | Per circuit | Per floor |
| Live data | No | Yes | Yes |
| Alerts | No | Yes | Yes |
| Cost per block | ₹0 | ₹3,50,000 | ₹38,000 |
| Student feedback | No | No | Yes |

## 10. Cost estimate

| Item | Quantity | Cost |
| --- | --- | --- |
| Smart meter boards | 12 | ₹18,000 |
| Current transformers | 24 | ₹7,200 |
| Wi-Fi access points | 3 | ₹6,600 |
| Cloud hosting (one year) | 1 | ₹4,800 |
| Enclosures and wiring | 12 | ₹1,400 |

## 11. Project timeline

- Week 1–2: Survey. Map every circuit in the three blocks.
- Week 3–5: Hardware. Build, calibrate and install the meters.
- Week 6–8: Software. Build the dashboard and alert rules.
- Week 9–14: Trial. Run the system and collect readings.
- Week 15–16: Report. Analyse results and write up.

## 12. Team

- Kaaviya R: Hardware and calibration
- Arun K: Cloud and alerts
- Divya S: Dashboard and user study

## 13. Conclusion and future work

Per-floor metering turned an invisible cost into one that wardens and students could act on. The system saved 31% of hostel energy over six weeks at a cost that pays back in under a year.

- Extend metering to academic blocks and labs
- Switch corridor lights automatically from the alerts
- Add solar generation data to the dashboard

## References

- [1] Petersen, J. et al. Dormitory residents reduce electricity consumption when exposed to real-time visual feedback. International Journal of Sustainability in Higher Education, 2007.
- [2] Espressif Systems. ESP32 Technical Reference Manual, 2023.
- [3] Kumar, S. and Rao, P. Low-cost IoT energy meters for Indian institutions. IEEE Sensors Letters, 2022.
- [4] Allcott, H. Social norms and energy conservation. Journal of Public Economics, 2011.
- [5] Bureau of Energy Efficiency. Energy Conservation Building Code, 2017.
- [6] Gupta, A. Occupancy-driven lighting control in shared spaces. Energy and Buildings, 2021.

## Thank you
`;

export const sampleReportFile = () =>
  new File([sampleReport], sampleReportName, { type: "text/markdown" });

/** Short document excerpts and the slide each one becomes. */
export const importExamples: {
  id: string;
  label: string;
  rule: string;
  tip: string;
  markdown: string;
}[] = [
  {
    id: "headings",
    label: "Headings",
    rule: "Each heading starts a slide",
    tip: "Use Word's Heading 1 and Heading 2 styles, or # and ## in Markdown. Sentences under a heading become its points.",
    markdown: `## Why it matters

Hostels use most of their power after 9 pm. Lighting and water heaters lead the load. Simple changes could cut it by a third.`,
  },
  {
    id: "steps",
    label: "Steps",
    rule: "Numbered steps become a process",
    tip: "Short numbered items under a heading such as Method, Process or Workflow are drawn as connected steps.",
    markdown: `## Methodology

1. Survey the blocks
2. Fit smart meters
3. Build the dashboard
4. Run the trial`,
  },
  {
    id: "numbers",
    label: "Numbers",
    rule: "Label: value lines become a chart",
    tip: "Write results as “Label: 31%”. Three to six of them become an editable chart with the two largest called out.",
    markdown: `## Results

- Energy saved: 31%
- Evening peak cut: 24%
- Alerts acted on: 87%
- Meter uptime: 98%`,
  },
  {
    id: "tables",
    label: "Tables",
    rule: "Tables stay editable tables",
    tip: "The first row is the header. Long tables continue on extra slides when you choose Full detail.",
    markdown: `## Comparison with existing systems

| Feature | Building meter | Our system |
| --- | --- | --- |
| Detail | Whole building | Per floor |
| Live data | No | Yes |
| Alerts | No | Yes |`,
  },
  {
    id: "timeline",
    label: "Dates",
    rule: "Dated lists become a timeline",
    tip: "Start each item with its date or week, then a colon: “Week 3–5: Hardware. Build the meters.”",
    markdown: `## Project timeline

- Week 1–2: Survey. Map every circuit.
- Week 3–5: Hardware. Build the meters.
- Week 6–8: Software. Build the dashboard.
- Week 9–14: Trial. Collect readings.`,
  },
  {
    id: "question",
    label: "Questions",
    rule: "A question frames the problem",
    tip: "Under a Problem or Challenge heading, end with the question you answer. It becomes the slide's highlight.",
    markdown: `## Problem statement

Hostel blocks pay for power that nobody is using.

- Corridor lights stay on all night
- Heaters run long after the rush

How can a hostel cut the power it wastes?`,
  },
];
