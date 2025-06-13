// main.js

// returns true if the selector exists on the current page
function has(sel) {
  return document.querySelector(sel) !== null;
}

let allData, countiesTopo;
let recourseData = [];          
let sourceNecessity = []; 
let selectedFips = null;
const tooltip = d3.select("#tip");
// ────────────────────────────────────────────────────────────────────────────────
// 1) LOAD data_features.csv + COUNTY TOPOJSON (no year filters anymore)
Promise.all([
  d3.csv("data_features.csv", d3.autoType),
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json"),
  d3.csv("dummy_algo.csv",     d3.autoType),
  d3.csv("models/disaster-assessment-tool/importance_scores_v4b/source_necessity_scores.csv", d3.autoType)

]).then(([rows, us, tempRows, sourceRows]) => {
  allData           = rows;
  countiesTopo      = topojson.feature(us, us.objects.counties).features;
  recourseData      = tempRows;
  sourceNecessity   = sourceRows;          // <–– NEW
  drawAll();
})
.catch(err => console.error("Data load error:", err));


// CHOROPLETH: COUNTIES FOR SELECTED YEAR
function drawMap(data) {
  const svg = d3.select("#map"),
        W   = svg.node().clientWidth,
        H   = svg.node().clientHeight;
  svg.selectAll("*").remove();

  // 1) Responsive projection + path generator
const proj = d3.geoAlbersUsa()
.fitSize([W, H], {type: "FeatureCollection", features: countiesTopo});

svg.attr("viewBox", `0 0 ${W} ${H}`);   // keep map crisp when SVG resizes

const pathGen = d3.geoPath().projection(proj);


  // 2) Count how many rows per FIPS (number of events or records per county)
  const counts = d3.rollups(
    data,           // data = allData from data_features.csv
    vs => vs.length,
    d  => String(d.FIPS).padStart(5, '0')  // ensure five‐digit string
  );
  // counts = [ [ "04005", 12 ], [ "06037", 7 ], … ]

  const countMap = new Map(counts); 
  // Map { "04005" → 12, "06037" → 7, … }

  // 3) Let’s pick a single “fill color” for any county that appears at least once.
  //    If you want a heatmap by the raw count, you can replace this step with a colorScale.
  //    For now, we’ll just do: present = blue; absent = #eee.
  const presentColor = "#3182bd";  
  const absentColor  = "#eee";

  // 4) Draw every county path
  svg.selectAll("path")
    .data(countiesTopo)
    .join("path")
      .attr("d", pathGen)
      .attr("fill", d => {
        // d.id is a string or number. We’ll treat it as a zero‐padded string:
        const fips = String(d.id).padStart(5, '0');

        return countMap.has(fips)
          ? presentColor
          : absentColor;
      })
      .attr("stroke", "#999")
      .attr("stroke-width", 1)
      .on("click", (e, d) => {
        const fips = String(d.id).padStart(5, "0");
        selectedFips = fips; 
        if (has("#bar"))        drawFeatureBar(fips);      // Attribution page only
        if (has("#instance-data")) updateDataDisplay(fips); // Recourse page only
        if (has("#user-input"))    updateUserInput(fips);   // Recourse page only

        const row = recourseData.find(r=>String(r.FIPS).padStart(5,"0")===fips);
  const modelSev = row ? row.severity : "low";   // fallback demo value
  drawSeverityChart(modelSev, modelSev);
      })
    
      .on("mouseover", (e, d) => {
        const fips = String(d.id).padStart(5, '0');
        const c = countMap.get(fips) || 0;
        tooltip
          .style("opacity", 0.9)
          .html(`<strong>FIPS ${fips}</strong><br>${c} record${c===1?"":"s"}`)
          .style("left", (e.pageX + 10) + "px")
          .style("top",  (e.pageY - 28) + "px");
        d3.select(e.currentTarget)
          .attr("stroke", "#000")
          .attr("stroke-width", 2);
      })
      .on("mouseout", (e, d) => {
        tooltip.style("opacity", 0);
        d3.select(e.currentTarget)
          .attr("stroke", "#999")
          .attr("stroke-width", 1);
      });

  // 5) (Optional) Legend: “Blue = county in data_features.csv; Light gray = not in data”
  const legend = svg.append("g")
    .attr("transform", `translate(20, ${H - 60})`);

  const legendData = [
    { color: presentColor, label: "Counties of Importance" },
    { color: absentColor,  label: "Other Counties" }
  ];

  legend.selectAll("rect")
    .data(legendData)
    .join("rect")
      .attr("x",   (d,i) => i * 180)
      .attr("y",     0)
      .attr("width", 20)
      .attr("height",20)
      .attr("fill",  d => d.color);

  legend.selectAll("text")
    .data(legendData)
    .join("text")
      .attr("x", (d,i) => i * 180 + 26)
      .attr("y", 14)
      .style("font-size","12px")
      .text(d => d.label);

  // 6) Title
  svg.append("text")
    .attr("x", W/2).attr("y", 32)
    .attr("text-anchor", "middle")
    .style("font-weight", "600")
    .text("All Counties (from data_features.csv)");
}

function extractTopFeatures(row, n = 20) {
  // 1) Collect all keys that start with "necessity_"
  const featureData = [];
  Object.keys(row).forEach(key => {
    if (key.startsWith("necessity_")) {
      // Remove the "necessity_" prefix
      const featName = key.replace("necessity_", "");
      // Convert the raw string to a number
      const val = +row[key];
      featureData.push({ feature: featName, value: val });
    }
  });

  // 2) Sort descending by value
  featureData.sort((a, b) => b.value - a.value);

  // 3) Return the first n items (or fewer if there aren't n)
  return featureData.slice(0, n);
}


function drawFeatureBar(fips) {
  if (!has("#bar")) return;
  const svg = d3.select("#bar"),
        W   = svg.node().clientWidth,
        H   = svg.node().clientHeight;
  svg.selectAll("*").remove(); 
  
  
  // 1) Load the entire CSV of instance-level necessity scores
  d3.csv("importance_scores_v4b/instance_necessity_scores.csv", d3.autoType)
    .then(rawData => {
      // 2) Find the single row whose "c" column matches the clicked FIPS
      //    Coerce both to strings to avoid type mismatches.
      //const row = rawData.find(d => String(d.FIPS) === String(fips));
      const row = rawData.find(d => (+d.FIPS) === (+fips));
      if (!row) {
        svg.append("text")
          .attr("x",  W / 2)
          .attr("y",  H / 2)
          .attr("text-anchor", "middle")
          .style("fill", "darkred")
          .text(`No necessity‐score data for FIPS ${fips}`);
        return;
      }
      n = 20
      // 3) Extract the top 15 features by necessity value
      const top15 = extractTopFeatures(row, n);
      // Now top15 is an array like:
      //   [ { feature: "transition_1_0", value: 0.87 },
      //     { feature: "News_Injuries",   value: 0.75 },
      //     … up to 15 items … ]

      // 4) If there are no "necessity_" keys at all, showing a message
      if (top15.length === 0) {
        svg.append("text")
          .attr("x",  W / 2)
          .attr("y",  H / 2)
          .attr("text-anchor", "middle")
          .style("fill", "darkred")
          .text(`No "necessity_" features found for FIPS ${fips}`);
        return;
      }

      // 5) Define margins & inner dimensions
      const margin = { top: 40, right: 20, bottom: 60, left: 100 },
            innerW = W - margin.left - margin.right,
            innerH = H - margin.top  - margin.bottom;

      // 6) Build scales based on the top15 data
      const xScale = d3.scaleLinear()
        .domain([0, d3.max(top15, d => d.value) || 1])
        .range([margin.left, margin.left + innerW]);

      const yScale = d3.scaleBand()
        .domain(top15.map(d => d.feature))
        .range([margin.top, margin.top + innerH])
        .padding(0.1);

      // 7) Draw X-axis at the bottom
      svg.append("g")
        .attr("transform", `translate(0, ${margin.top + innerH})`)
        .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format(".2f")));

      // 8) Draw Y-axis on the left
      svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(yScale));

      // 9) Chart title
      svg.append("text")
        .attr("class", "chart-title")
        .attr("x", (W / 2) - 1)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .text(`Top ${n} Necessity Features for FIPS ${fips}`);

      // 10) X-axis label
      svg.append("text")
        .attr("class", "axis-label")
        .attr("x", margin.left + innerW / 2)
        .attr("y", margin.top + innerH + 50)
        .attr("text-anchor", "middle")
        .text("Necessity Value (0–1)");

      // 11) Y-axis label (vertical)
      svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", - (margin.top + innerH / 2))
        .attr("y", margin.left - 80)
        .attr("text-anchor", "middle")
        .text("Feature");

      // 12) Draw the 15 bars
      svg.selectAll("rect")
        .data(top15)
        .join("rect")
          .attr("x",      d => margin.left)
          .attr("y",      d => yScale(d.feature))
          .attr("width",  d => xScale(d.value) - margin.left)
          .attr("height", yScale.bandwidth())
          .attr("fill",   "#3182bd")
        .on("mouseover", (e, d) => {
          tooltip
            .style("opacity", 0.9)
            .html(`<strong>${d.feature}</strong><br>Value: ${d3.format(".2f")(d.value)}`)
            .style("left", (e.pageX + 8) + "px")
            .style("top",  (e.pageY - 28) + "px");
          d3.select(e.currentTarget).attr("fill", "#f49e4c");
        })
        .on("mouseout", () => {
          tooltip.style("opacity", 0);
          d3.selectAll("#bar rect").attr("fill", "#3182bd");
        });

    })
    .catch(err => {
      console.error("Could not load necessity_scores CSV:", err);
      svg.append("text")
        .attr("x",  W / 2)
        .attr("y",  H / 2)
        .attr("text-anchor", "middle")
        .style("fill", "darkred")
        .text("Error loading necessity‐score data.");
    });
}

function clearWorldMap() {
  d3.select("#layerControls").html("");
  d3.select("#worldmap").selectAll("*").remove();
}

// ── Populate Feature, Source, Group dropdowns ──────────────────────────
d3.csv('models/disaster-assessment-tool/assets/groupings/feature_groupings.csv')
  .then(rows => {
    if (!rows.length) return;

    // auto-detect columns  A = Feature, B = Group, C = Source
    const cols      = Object.keys(rows[0]);
    const featKey   = cols[0];         // e.g. "feature"
    const groupKey  = cols[1];         // e.g. "group"
    const sourceKey = cols[2];         // e.g. "source"

    /* ---------- 1.  FEATURES  – checkbox per row ------------------- */
    const featCont = d3.select('#feature-dropdown .dropdown-content');
    rows.forEach(r => {
      const val = r[featKey];
      const id  = `feat-${val.replace(/\W+/g,'_')}`;
      const lbl = featCont.append('label').attr('for', id);
      lbl.append('input')
         .attr('type','checkbox')
         .attr('id',   id)
         .attr('value',val);
      lbl.append('span').text(` ${val}`);
    });

    /* ---------- 2.  SOURCES  – checkbox per unique value ----------- */
    const uniqueSources = Array.from(new Set(rows.map(r => r[sourceKey])));
    const srcCont = d3.select('#source-dropdown .dropdown-content');
    uniqueSources.forEach(s => {
      const id  = `src-${s.replace(/\W+/g,'_')}`;
      const lbl = srcCont.append('label').attr('for', id);
      lbl.append('input')
         .attr('type','checkbox')
         .attr('id',   id)
         .attr('value',s);
      lbl.append('span').text(` ${s}`);
    });

    /* ---------- 3.  FEATURE GROUPS  –  single-select list ---------- */
    const uniqueGroups = Array.from(new Set(rows.map(r => r[groupKey])));
    const grpCont = d3.select('#group-dropdown .dropdown-content');

    /** helper: mark selected item */
    function selectGroup(g){
      grpCont.selectAll('a').classed('selected', d => d === g);
      // TODO: call whatever update/filter routine you already have
      console.log('Selected group:', g);
    }

    grpCont.selectAll('a')
      .data(uniqueGroups)
      .join('a')
        .attr('href','#')
        .text(d => d)
        .on('click', (e,d) => {          // single-select click
          e.preventDefault();
          selectGroup(d);
        });
  })
  .catch(err => console.error('Failed to load grouping CSV:', err));


// 🔁  replace ALL copies of updateDataDisplay() with exactly ONE copy
function updateDataDisplay(fips) {
  if (!has("#instance-data")) return;
  // make sure both sides are numbers OR both are 5-digit strings
  const row = recourseData.find(r => +r.FIPS === +fips);   // <─ coercion

  const box = d3.select("#instance-data");
  box.selectAll("p").remove();

  if (!row) {
    box.append("p").text(`No data for FIPS ${fips}`);
  } else {
    box.append("p").text(`Severity: ${row.severity}`);
  }
}

  
  
function updateUserInput(fips) {
  if (!has("#user-input")) return; 
  const row = recourseData.find(r => String(r.FIPS).padStart(5,"0") === fips);
  const container = d3.select("#user-input");

  container.selectAll("label, select, p").remove();

  if (!row) {
    container.append("p").text(`No editable data for FIPS ${fips}`);
    return;
  }

  const levels = ["low","medium","high"];

  container.append("label")
           .attr("for","severity-select")
           .text("Set severity: ");

  container.append("select")
           .attr("id","severity-select")
           .selectAll("option")
           .data(levels)
           .join("option")
             .attr("value", d => d)
             .property("selected", d => d === row.severity) // pre-select CSV value
             .text(d => d.charAt(0).toUpperCase() + d.slice(1))
             .on("change", function(){
              const userSev = this.value;
              console.log(`User set ${fips} → ${userSev}`);
              drawSeverityChart(row.severity, userSev);    // live update
            });
}


// ─── Severity helpers ────────────────────────────────────────────
const sevScale = { low: 1, medium: 2, high: 3 };
const sevLabels = ["Low","Medium","High"];

/**
 * Draw/refresh the 2-bar comparison.
 * @param {string} modelS  severity from CSV  ("low"|"medium"|"high")
 * @param {string} userS   severity from dropdown (same set)
 */
function drawSeverityChart(modelS, userS){
  if(!has("#chart")) return;                         // wrong page

  const W = 200, H = 160, margin = {t:20,r:20,b:30,l:40};

  // convert to numeric
  const data = [
    {src:"Model", val: sevScale[modelS]},
    {src:"User",  val: sevScale[userS]}
  ];

  // root
  const box   = d3.select("#chart");
  box.selectAll("*").remove();                       // clear previous
  const svg   = box.append("svg")
                   .attr("width",  W)
                   .attr("height", H);

  // scales
  const x = d3.scaleBand()
              .domain(data.map(d=>d.src))
              .range([margin.l, W-margin.r])
              .padding(0.35);
  const y = d3.scaleLinear()
              .domain([0,3]).nice()
              .range([H-margin.b, margin.t]);

  // axes
  svg.append("g").attr("transform",`translate(0,${H-margin.b})`)
     .call(d3.axisBottom(x));
  svg.append("g").attr("transform",`translate(${margin.l},0)`)
     .call(d3.axisLeft(y).ticks(3)
                        .tickFormat(d=>sevLabels[d-1]));

  // bars
  svg.selectAll("rect")
     .data(data)
     .join("rect")
       .attr("x", d=>x(d.src))
       .attr("y", d=>y(d.val))
       .attr("width", x.bandwidth())
       .attr("height", d=>y(0)-y(d.val))
       .attr("fill", "#3182bd");
}

/* ───────── Source-wise bar chart ───────────────────────── */
/* ─── Source-wise 3-bar chart ───────────────────────────────────────── */
function drawSourceBar(fips){
  if(!has("#bar")) return;

  const row = sourceNecessity.find(r => String(r.FIPS).padStart(5,'0') === fips);
  if(!row){
    d3.select("#bar").html("<p style='padding:1rem'>No source-level data for this county</p>");
    return;
  }

  /* 1. DATA --------------------------------------------------------- */
  const data = [
    {src:"News",           val:+row.necessity_News},
    {src:"Reddit",         val:+row.necessity_Reddit},
    {src:"Remote Sensing", val:+row.necessity_Transition}
  ];
  const color = d3.scaleOrdinal()
        .domain(data.map(d=>d.src))
        .range(["#d4a73d","#d1793d","#c94d5f"]);   // gold, clay, rose

  /* 2. SIZE — use container’s actual size -------------------------- */
  const box = d3.select("#bar").html("");          // clear previous
  const W = box.node().clientWidth,
        H = box.node().clientHeight;
  const m = {t:40,r:20,b:50,l:60};

  const svg = box.append("svg")
                 .attr("viewBox",`0 0 ${W} ${H}`)
                 .attr("width","100%").attr("height","100%");

  /* 3. SCALES + AXES ----------------------------------------------- */
  const x = d3.scaleBand()
              .domain(data.map(d=>d.src))
              .range([m.l, W-m.r]).padding(0.3);
  const y = d3.scaleLinear()
              .domain([0, d3.max(data,d=>d.val)||1]).nice()
              .range([H-m.b, m.t]);

  svg.append("g")
     .attr("transform",`translate(0,${H-m.b})`)
     .call(d3.axisBottom(x).tickSizeOuter(0));
  svg.append("g")
     .attr("transform",`translate(${m.l},0)`)
     .call(d3.axisLeft(y));
  svg.append("g")                                 // X-axis
     .attr("transform",`translate(0,${H-m.b})`)
     .call(d3.axisBottom(x).tickSizeOuter(0));
  
  svg.append("g")                                 // Y-axis
     .attr("transform",`translate(${m.l},0)`)
     .call(d3.axisLeft(y));
  
  /* NEW → Y-axis label */
  svg.append("text")
     .attr("transform","rotate(-90)")
     .attr("x", -(H/2))
     .attr("y", m.l - 45)
     .attr("text-anchor","middle")
     .attr("font-size",".85rem")
     .attr("font-weight",600)
     .text("Necessity Score");
  

  /* 4. BARS + tooltip ---------------------------------------------- */
  svg.selectAll("rect")
     .data(data)
     .join("rect")
       .attr("x", d=>x(d.src))
       .attr("y", d=>y(d.val))
       .attr("width", x.bandwidth())
       .attr("height", d=>y(0)-y(d.val))
       .attr("fill", d=>color(d.src))
       .on("mouseover",(e,d)=>{
          tooltip.style("opacity",0.9)
                 .html(`${d.src}: ${d3.format(".3f")(d.val)}`)
                 .style("left",(e.pageX+8)+"px")
                 .style("top",(e.pageY-28)+"px");
       })
       .on("mouseout",()=>tooltip.style("opacity",0));

  /* 5. TITLE -------------------------------------------------------- */
  svg.append("text")
     .attr("x",W/2).attr("y",m.t-15)
     .attr("text-anchor","middle")
     .attr("font-size","1.05rem")
     .attr("font-weight",600)
     .text(`Source-wise Necessity Importance for FIPS ${fips}, ${row.County_Name}, ${row.State}`)


  /* 6. LEGEND (colored dots) --------------------------------------- */
  const leg = svg.append("g")
                 .attr("transform",`translate(${W-m.r-120},${m.t})`);
  leg.selectAll("rect")
     .data(data)
     .join("rect")
       .attr("x",0).attr("y",(d,i)=>i*18)
       .attr("width",14).attr("height",14)
       .attr("fill",d=>color(d.src));
  leg.selectAll("text")
     .data(data)
     .join("text")
       .attr("x",20).attr("y",(d,i)=>i*18+11)
       .attr("font-size",".8rem")
       .text(d=>d.src);
}


d3.select("#source-btn").on("click", () => {
  if (selectedFips) {
    drawSourceBar(selectedFips);
  } else {
    alert("Click a county on the map first.");
  }
});

// ------------- clear on year/change --------------
function drawAll() {
  drawMap(allData);
  d3.select("#bar").selectAll("*").remove();
}

// your existing boot call:
drawAll();
// ensure all three charts re‑render on window resize
window.addEventListener("resize", drawAll);
