// File name: main.js
// File description: contains script to chloropeth map used on pages

let allData, countiesTopo;
let mapExist = true, barExist = true;
const tooltip = d3.select("#tip");

// make sure #map and #bar exists - do a check and put to boolean vars
if (d3.select('#map').empty()) {
  console.warn("#map does not exist.");
  mapExist = false;
  // all pages should have a chloro map, return if none?
}
if (d3.select('#bar').empty()) {
  console.warn("#bar does not exist.");
  barExist = false;
}

// ────────────────────────────────────────────────────────────────────────────────
// 1) LOAD data_features.csv + COUNTY TOPOJSON (no year filters anymore)
Promise.all([
  d3.csv("data_features.csv", d3.autoType),
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
]).then(([rows, us]) => {
  allData      = rows;  // now allData has every row from data_features.csv
  countiesTopo = topojson.feature(us, us.objects.counties).features;
  drawAll();           // jump straight to drawing—no initFilters()
})
.catch(err => console.error("Data load error:", err));


// CHOROPLETH: COUNTIES FOR SELECTED YEAR
function drawMap(data) {
  if (!mapExist) { return; } // return if #map does not exist
  
  const svg = d3.select("#map"),
        W   = svg.node().clientWidth,
        H   = svg.node().clientHeight;
  svg.selectAll("*").remove();

  // 1) Projection + path generator
  const proj    = d3.geoAlbersUsa()
                    .translate([W/2, H/2])
                    .scale(1100);
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
        // When you click a county, we want to draw its feature bar:
        const clickedFips = String(d.id).padStart(5, '0');
        console.log("Clicked FIPS:", clickedFips);

        // Before we do anything else, check that #map still exists
        const mapElemt = document.getElementById("map");
        if (!mapElemt) {
          console.warn("#map is missing before calling drawFeatureBar");
          return;
        }

        try {
          drawFeatureBar();

        } catch (err) {
          console.warn("Error from drawFeatureBar upon click on #map svg");
        }

      
        drawAll();
        // If you still want to draw your dynamic world map, keep this block:
        //drawWorldMap(d); 
        // else you can omit it.
      })
      .on("mouseover", (e, d) => {
        const fips = String(d.id).padStart(5, '0');
        // console.log("Drawing feature bar for:", fips);
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
    { color: presentColor, label: "County present in data" },
    { color: absentColor,  label: "County not in data" }
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

function extractTopFeatures(row, n = 15) {
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
  if (!barExist) { return ; } // return if #bar does not exist

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

      // 3) Extract the top 15 features by necessity value
      const top15 = extractTopFeatures(row, 15);
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
        .text(`Top 15 Necessity Features for FIPS ${fips}`);

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

// ------------- clear on year/change --------------
function drawAll() {
  console.log("Redrawing #map and clearing #bar");
  if (!mapExist) { return; } // return if #map does not exist
  drawMap(allData);

  if (!barExist) { return; } // return if #bar does not exist
  d3.select("#bar").selectAll("*").remove();
}

// your existing boot call:
drawAll();
// ensure all three charts re‑render on window resize
window.addEventListener("resize", drawAll);


// Test 

// const mapElemt = document.getElementById("map");
// if (!mapElemt) {
//   console.warn("#map element is missing after click!");
// } else {
//   console.log("#map still exists after click.");
// }

// console.log("Is #map still visible?", d3.select("#map").style("display"));
// console.log("SVG child count:", d3.select("#map").node().childElementCount);

// const svg = document.querySelector("#map");
// console.log("SVG size:", svg.clientWidth, svg.clientHeight);