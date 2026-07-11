// Third insights wave, from the LEAP home energy audit (report #387364,
// March 10, 2026, auditor Andrew Robinson, Local Energy Alliance Program,
// 434-227-4666). BPI health & safety screening: ambient CO, flue CO, and
// venting passed; gas leak and mold & moisture FAILED.

export const energyAuditInsights = {
  systemUpdates: [
    {
      match: "heating",
      data: {
        condition: "attention",
        note: "Energy audit (3/10/26): furnace 'in need of repair, warrants a service call', and the filter was found askew/damaged — replace it. Installed 2021 by Monticello Air (434-246-7111), warranty registered; last documented service March 2022. Auditor also recommends an HVAC tech improve whole-home ventilation. Fuel is propane.",
      },
    },
    {
      match: "water heater",
      data: {
        detail: "Two A.O. Smith propane power-vent tank units",
        brand: "A.O. Smith",
        installYear: "2013 (unit 1); unit 2 unknown",
        condition: "urgent",
        note: "Energy audit (3/10/26) failed the gas-leak screen here: unusual burner corrosion suggests a unit is not firing properly, and the exhaust-pipe gasket needs tightening. Service call recommended promptly. Exhaust vents sit close to the ground — keep clear of debris. Unit 1 is ~13 years into a ~20-year life; audit models up to $800/yr savings from a heat-pump + high-efficiency replacement pair when the time comes. Also: don't store flammables nearby.",
      },
    },
    {
      match: "basement kitchen",
      data: {
        condition: "urgent",
        note: "Energy auditor (3/10/26), verbatim: 'Fix this stove or get rid of it.' Same combustion-safety concern the 2021 inspection flagged — unvented/misfiring appliances degrade indoor air quality fast in a house this airtight. Repair or decommission.",
      },
    },
  ],

  systemAdds: [
    {
      category: "Windows",
      detail: "~898 ft² total; U-0.51, non-Energy Star",
      condition: "attention",
      note: "Energy audit (3/10/26) found biological growth (mold) on windows in the dining room, guest bedroom, guest bathroom, and master bedroom — a moisture/ventilation problem, not just a cleaning item. Clean the growth, then fix the cause (see Ventilation). Full replacement is optional; targeted repairs and air sealing around frames are the cost-effective path.",
    },
    {
      category: "Ventilation",
      detail: "Whole-home mechanical ventilation below requirement",
      condition: "attention",
      note: "Audit measured three bathroom fans at 0 CFM (not working or not vented) and ASHRAE 62.2 calls for 254 CFM for this house. An existing supply ventilator runs 95 CFM intermittently; its vinyl duct should be replaced and rerouted. The house is airtight for its age (4.08 ACH50), which makes weak ventilation a health issue, not just comfort. Get an HVAC tech to upgrade fans, vent them to the exterior, and balance fresh air.",
    },
    {
      category: "Attic & Insulation",
      detail: "R-20 average (10\") vs. R-49 Virginia code target",
      condition: "good",
      note: "Professionally air sealed at some point — house tests at 4.08 ACH50, near new-construction tightness. Topping up insulation to R-49 is the audit's #2 upgrade (~$240/yr savings); air sealing touch-ups ~$117/yr; basement utility-room weatherization ~$330/yr. Package total ~$687/yr (~9% of the ~$7,800/yr energy spend).",
    },
    {
      category: "Drainage & Grading",
      detail: "Two exterior drainage issues noted",
      condition: "attention",
      note: "Energy audit flagged an issue near a retaining wall (may require removing a tree and/or adjusting the wall) and a low spot in the lawn by one door that should be regraded so water flows away from the house. Related: keep a 2–3 ft no-plant zone at the foundation and extend downspouts 5–6 ft out.",
    },
  ],

  priorityUpdates: [
    {
      match: "hvac service",
      data: {
        title: "HVAC service call — furnace repair + damaged filter",
        urgency: "high",
        reason: "Energy audit (3/10/26) says the furnace needs repair and the filter is askew/damaged. Last documented service was March 2022. Ask the tech to also scope ventilation improvements (three bath fans measured 0 CFM).",
        estCost: "$150 – $400",
      },
    },
  ],

  priorityAdds: [
    {
      title: "Water heater service — burner corrosion & exhaust gasket",
      category: "Safety",
      reason: "Failed the audit's gas-leak screen: burner corrosion suggests misfiring, and the exhaust gasket needs tightening. Combustion appliances in an airtight house deserve prompt attention.",
      estCost: "$150 – $350",
      urgency: "high",
    },
    {
      title: "Repair or decommission the basement stove",
      category: "Safety",
      reason: "Flagged by both the 2021 inspection and the 2026 energy audit ('Fix this stove or get rid of it'). Five years is long enough.",
      estCost: "$0 decommission / repair varies",
      urgency: "high",
    },
    {
      title: "Clean window mold + fix ventilation cause",
      category: "Health",
      reason: "Biological growth on windows in four rooms per the audit — driven by weak mechanical ventilation (three bath fans at 0 CFM vs. 254 CFM required). Clean, then upgrade/vent the fans properly.",
      estCost: "$100 clean / $500 – $1,500 fans",
      urgency: "medium",
    },
    {
      title: "Replace/vent the three dead bathroom exhaust fans",
      category: "Ventilation",
      reason: "Audit measured three bath fans at 0 CFM — not working or not ducted to the exterior. Replace/upsize and confirm they vent outside; this is the ventilation cause behind the window mold.",
      estCost: "$500 – $1,500",
      urgency: "medium",
    },
    {
      title: "Weatherization package: attic to R-49, air sealing, basement utility rooms",
      category: "Efficiency",
      reason: "The audit's modeled package saves ~$687/yr on a ~$7,800/yr energy spend. Attic insulation and utility-room weatherization are the big movers; get contractor quotes.",
      estCost: "quotes needed",
      urgency: "low",
    },
    {
      title: "Regrade low spot & assess retaining-wall drainage",
      category: "Exterior",
      reason: "Audit flagged drainage issues at a retaining wall (tree may be implicated) and a low spot by one door. Cheap prevention against basement moisture.",
      estCost: "$200 – $800",
      urgency: "low",
    },
  ],

  jobAdds: [
    {
      date: "March 10, 2026",
      title: "Home energy audit",
      category: "Assessment",
      sub: "LEAP — Andrew Robinson (434-227-4666)",
      status: "completed",
      cost: "—",
      notes: "Report #387364. Blower door 3,581 CFM50 = 4.08 ACH50 (tight for the age). Passed CO and venting screens; failed gas-leak (water heater burner corrosion) and mold & moisture (window growth, dead bath fans). Recommended package saves ~$687/yr.",
    },
  ],

  calendarAdds: [],

  profileUpdates: {},
}
