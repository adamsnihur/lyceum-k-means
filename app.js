/**
 * Lyceum: Analiza Skupień k-means
 * Silnik obliczeniowy, symulator Lloyda 2D Canvas, wykresy Plotly & interaktywny quiz
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Inicjalizacja KaTeX Auto-Render
  if (typeof renderMathInElement === "function") {
    renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false }
      ],
      throwOnError: false
    });
  }

  // 2. Stałe i Paleta Kolorów SaaS
  const CLUSTER_COLORS = [
    { fill: "#2563eb", light: "rgba(37, 99, 235, 0.08)", name: "Niebieski" },    // Blue
    { fill: "#059669", light: "rgba(5, 150, 105, 0.08)", name: "Szmaragdowy" },  // Emerald
    { fill: "#d97706", light: "rgba(217, 119, 6, 0.08)", name: "Bursztynowy" },  // Amber
    { fill: "#e11d48", light: "rgba(225, 29, 72, 0.08)", name: "Karminowy" },    // Rose
    { fill: "#6366f1", light: "rgba(99, 102, 241, 0.08)", name: "Indygo" },      // Indigo
    { fill: "#0891b2", light: "rgba(8, 145, 178, 0.08)", name: "Turkusowy" }     // Cyan
  ];

  // 3. Stan Symulatora Lloyda 2D
  const canvas = document.getElementById("kmeansCanvas");
  const ctx = canvas.getContext("2d");

  let points = [];
  let centroids = [];
  let k = 3;
  let initMethod = "kmeanspp";
  let phase = "READY"; // READY -> ASSIGNED -> UPDATED -> CONVERGED
  let iteration = 0;
  let lastShift = 0;
  let wcssHistory = [];
  let isPlaying = false;
  let playInterval = null;

  // Elementy DOM
  const kSlider = document.getElementById("kSlider");
  const kValBadge = document.getElementById("kValBadge");
  const initMethodSelect = document.getElementById("initMethodSelect");
  const stepBtn = document.getElementById("stepBtn");
  const playBtn = document.getElementById("playBtn");
  const playBtnText = document.getElementById("playBtnText");
  const resetCentroidsBtn = document.getElementById("resetCentroidsBtn");
  const clearDataBtn = document.getElementById("clearDataBtn");
  const presetButtons = document.querySelectorAll(".preset-btn");

  const pointCountVal = document.getElementById("pointCountVal");
  const iterationCountVal = document.getElementById("iterationCountVal");
  const shiftVal = document.getElementById("shiftVal");
  const algoStatusBadge = document.getElementById("algoStatusBadge");
  const currentWcssVal = document.getElementById("currentWcssVal");
  const phaseBadgeOverlay = document.getElementById("phaseBadgeOverlay");
  const phaseText = document.getElementById("phaseText");
  const phaseDot = document.getElementById("phaseDot");

  // Inicjalizacja Rozmiaru Płótna (HiDPI)
  function setupCanvasResolution() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    renderCanvas();
  }

  // Helpery Matematyczne
  function distSq(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
  }

  function getCanvasLogicalSize() {
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  // Generowanie Syntetycznych Zbiorów Danych
  function generatePresetData(type) {
    const { width, height } = getCanvasLogicalSize();
    points = [];
    const count = 120;

    if (type === "gaussian") {
      // 3 naturalne klastry
      const centers = [
        { x: width * 0.28, y: height * 0.35, std: 42, n: 40 },
        { x: width * 0.72, y: height * 0.38, std: 45, n: 40 },
        { x: width * 0.50, y: height * 0.72, std: 40, n: 40 }
      ];
      centers.forEach(c => {
        for (let i = 0; i < c.n; i++) {
          const u1 = Math.random();
          const u2 = Math.random();
          const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
          const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
          points.push({
            x: Math.max(20, Math.min(width - 20, c.x + z0 * c.std)),
            y: Math.max(20, Math.min(height - 20, c.y + z1 * c.std)),
            cluster: -1
          });
        }
      });
    } else if (type === "four_blobs") {
      // 4 skupiska
      const centers = [
        { x: width * 0.25, y: height * 0.25, std: 35, n: 30 },
        { x: width * 0.75, y: height * 0.25, std: 35, n: 30 },
        { x: width * 0.25, y: height * 0.75, std: 35, n: 30 },
        { x: width * 0.75, y: height * 0.75, std: 35, n: 30 }
      ];
      centers.forEach(c => {
        for (let i = 0; i < c.n; i++) {
          const u1 = Math.random();
          const u2 = Math.random();
          const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
          const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
          points.push({
            x: Math.max(20, Math.min(width - 20, c.x + z0 * c.std)),
            y: Math.max(20, Math.min(height - 20, c.y + z1 * c.std)),
            cluster: -1
          });
        }
      });
    } else if (type === "circles") {
      // Dwa koncentryczne pierścienie (ilustracja ograniczenia k-means!)
      const cx = width * 0.5;
      const cy = height * 0.5;
      // Wewnętrzny dysk
      for (let i = 0; i < 50; i++) {
        const r = Math.sqrt(Math.random()) * 55;
        const theta = Math.random() * 2 * Math.PI;
        points.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta), cluster: -1 });
      }
      // Zewnętrzny pierścień
      for (let i = 0; i < 70; i++) {
        const r = 120 + (Math.random() - 0.5) * 35;
        const theta = Math.random() * 2 * Math.PI;
        points.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta), cluster: -1 });
      }
    } else {
      // Jednostajny szum
      for (let i = 0; i < count; i++) {
        points.push({
          x: 30 + Math.random() * (width - 60),
          y: 30 + Math.random() * (height - 60),
          cluster: -1
        });
      }
    }

    resetCentroids();
    updateDiagnosticPlots();
  }

  // Inicjalizacja Centroidów (k-means++ lub Losowa)
  function initCentroids() {
    if (points.length < k) return;
    centroids = [];

    if (initMethod === "kmeanspp") {
      // 1. Pierwszy centroid losowo
      const firstIdx = Math.floor(Math.random() * points.length);
      centroids.push({
        x: points[firstIdx].x,
        y: points[firstIdx].y,
        prevX: points[firstIdx].x,
        prevY: points[firstIdx].y,
        color: CLUSTER_COLORS[0]
      });

      // 2. Kolejne centroidy z wagami D^2
      while (centroids.length < k) {
        const distSqArr = points.map(p => {
          let minD = Infinity;
          for (let c of centroids) {
            const d = distSq(p, c);
            if (d < minD) minD = d;
          }
          return minD;
        });

        const sumDistSq = distSqArr.reduce((a, b) => a + b, 0);
        let randVal = Math.random() * sumDistSq;
        let selectedIdx = 0;

        for (let i = 0; i < distSqArr.length; i++) {
          randVal -= distSqArr[i];
          if (randVal <= 0) {
            selectedIdx = i;
            break;
          }
        }

        const nextP = points[selectedIdx];
        const cIdx = centroids.length;
        centroids.push({
          x: nextP.x,
          y: nextP.y,
          prevX: nextP.x,
          prevY: nextP.y,
          color: CLUSTER_COLORS[cIdx]
        });
      }
    } else {
      // Losowy wybór punktów (Forgy method)
      const used = new Set();
      while (centroids.length < k) {
        const idx = Math.floor(Math.random() * points.length);
        if (!used.has(idx)) {
          used.add(idx);
          const cIdx = centroids.length;
          centroids.push({
            x: points[idx].x,
            y: points[idx].y,
            prevX: points[idx].x,
            prevY: points[idx].y,
            color: CLUSTER_COLORS[cIdx]
          });
        }
      }
    }

    // Reset przypisań punktów
    points.forEach(p => p.cluster = -1);
    phase = "READY";
    iteration = 0;
    lastShift = 0;
    wcssHistory = [];
    updateUI();
    renderCanvas();
    renderWcssChart();
  }

  function resetCentroids() {
    stopPlay();
    initCentroids();
  }

  // Krok 1: Przypisanie (Assignment Step)
  function stepAssign() {
    if (centroids.length === 0 || points.length === 0) return;

    let totalWcss = 0;
    points.forEach(p => {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let j = 0; j < centroids.length; j++) {
        const d = distSq(p, centroids[j]);
        if (d < minDist) {
          minDist = d;
          bestCluster = j;
        }
      }
      p.cluster = bestCluster;
      totalWcss += minDist;
    });

    wcssHistory.push(totalWcss);
    phase = "ASSIGNED";
    updateUI();
    renderCanvas();
    renderWcssChart();
  }

  // Krok 2: Aktualizacja Centroidów (Update Step)
  function stepUpdate() {
    if (centroids.length === 0 || points.length === 0) return;

    let totalShift = 0;
    const { width, height } = getCanvasLogicalSize();

    centroids.forEach((c, j) => {
      c.prevX = c.x;
      c.prevY = c.y;

      const clusterPoints = points.filter(p => p.cluster === j);
      if (clusterPoints.length > 0) {
        const avgX = clusterPoints.reduce((sum, p) => sum + p.x, 0) / clusterPoints.length;
        const avgY = clusterPoints.reduce((sum, p) => sum + p.y, 0) / clusterPoints.length;
        const shift = Math.sqrt(distSq(c, { x: avgX, y: avgY }));
        totalShift += shift;
        c.x = avgX;
        c.y = avgY;
      } else {
        // Pusty klaster - zresetuj w losowy punkt
        c.x = 40 + Math.random() * (width - 80);
        c.y = 40 + Math.random() * (height - 80);
      }
    });

    lastShift = totalShift / centroids.length;
    iteration++;

    // Sprawdzenie kryterium zbieżności (zbiegło się jeśli średnie przesunięcie < 0.25px)
    if (lastShift < 0.25) {
      phase = "CONVERGED";
      stopPlay();
    } else {
      phase = "UPDATED";
    }

    updateUI();
    renderCanvas();
  }

  // Wykonaj Pojedynczy Krok Lloyda
  function executeLloydStep() {
    if (points.length === 0) return;
    if (centroids.length === 0) {
      initCentroids();
      return;
    }

    if (phase === "READY" || phase === "UPDATED") {
      stepAssign();
    } else if (phase === "ASSIGNED") {
      stepUpdate();
    } else if (phase === "CONVERGED") {
      stopPlay();
    }
  }

  // Autoodtwarzanie Zbieżności
  function togglePlay() {
    if (isPlaying) {
      stopPlay();
    } else {
      if (phase === "CONVERGED") {
        initCentroids();
      }
      isPlaying = true;
      playBtnText.textContent = "⏸️ Pauza";
      playBtn.classList.replace("bg-slate-900", "bg-amber-600");
      playBtn.classList.replace("hover:bg-slate-800", "hover:bg-amber-700");

      playInterval = setInterval(() => {
        if (phase === "CONVERGED") {
          stopPlay();
        } else {
          executeLloydStep();
        }
      }, 450);
    }
  }

  function stopPlay() {
    isPlaying = false;
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
    playBtnText.textContent = "⏩ Autoodtwarzanie";
    playBtn.classList.replace("bg-amber-600", "bg-slate-900");
    playBtn.classList.replace("hover:bg-amber-700", "hover:bg-slate-800");
  }

  // Renderowanie Canvas (Diagram Woronoja + Punkty + Centroidy)
  function renderCanvas() {
    const { width, height } = getCanvasLogicalSize();
    ctx.clearRect(0, 0, width, height);

    // 1. Tło: Subtelna siatka
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Terytoria Woronoja (Rasteryzacja niskiej rozdzielczości dla płynności 60fps)
    if (centroids.length > 0) {
      const step = 16;
      for (let x = 0; x < width; x += step) {
        for (let y = 0; y < height; y += step) {
          let minDist = Infinity;
          let bestC = 0;
          for (let j = 0; j < centroids.length; j++) {
            const d = distSq({ x: x + step / 2, y: y + step / 2 }, centroids[j]);
            if (d < minDist) {
              minDist = d;
              bestC = j;
            }
          }
          ctx.fillStyle = centroids[bestC].color.light;
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    // 3. Linie wektorowe łączące punkty z centroidami (Inwariant 2)
    if (phase !== "READY" && centroids.length > 0) {
      points.forEach(p => {
        if (p.cluster >= 0 && p.cluster < centroids.length) {
          const c = centroids[p.cluster];
          ctx.strokeStyle = c.color.light.replace("0.08", "0.25");
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        }
      });
    }

    // 4. Punkty Danych
    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      if (p.cluster >= 0 && p.cluster < centroids.length) {
        ctx.fillStyle = centroids[p.cluster].color.fill;
      } else {
        ctx.fillStyle = "#94a3b8"; // Nieprzypisany szary
      }
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    });

    // 5. Ścieżka przesunięcia centroidu (wektor delta)
    if (iteration > 0) {
      centroids.forEach(c => {
        ctx.strokeStyle = c.color.fill;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(c.prevX, c.prevY);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // 6. Centroidy (Wyraziste gwiazdy / romby z etykietami literowymi)
    centroids.forEach((c, idx) => {
      const size = 11;
      ctx.save();
      ctx.translate(c.x, c.y);

      // Cień centroidu
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;

      // Zewnętrzny kształt (Romb)
      ctx.fillStyle = c.color.fill;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size, 0);
      ctx.closePath();
      ctx.fill();

      // Biała obwódka
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      // Litera klastra
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String.fromCharCode(65 + idx), 0, 0);

      ctx.restore();
    });
  }

  // Wykres Liniowy Spadku WCSS (Real-time Plotly)
  function renderWcssChart() {
    const xVals = wcssHistory.map((_, i) => i + 1);
    const yVals = wcssHistory.map(v => Math.round(v));

    const trace = {
      x: xVals.length > 0 ? xVals : [1],
      y: yVals.length > 0 ? yVals : [0],
      type: "scatter",
      mode: "lines+markers",
      line: { color: "#2563eb", width: 2.5, shape: "spline" },
      marker: { color: "#1d4ed8", size: 6 }
    };

    const layout = {
      margin: { t: 10, r: 15, b: 25, l: 45 },
      xaxis: { title: "Krok przypisania", dtick: 1, tickfont: { size: 10, family: "JetBrains Mono" } },
      yaxis: { tickfont: { size: 10, family: "JetBrains Mono" }, autorange: true },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      hovermode: "x"
    };

    Plotly.react("wcssChart", [trace], layout, { displayModeBar: false, responsive: true });
  }

  // Aktualizacja Telemetrii UI
  function updateUI() {
    pointCountVal.textContent = points.length;
    iterationCountVal.textContent = iteration;
    shiftVal.textContent = `${lastShift.toFixed(2)} px`;

    // Aktualny WCSS
    if (wcssHistory.length > 0) {
      currentWcssVal.textContent = Math.round(wcssHistory[wcssHistory.length - 1]).toLocaleString();
    } else {
      currentWcssVal.textContent = "--";
    }

    // Fazy i Badge
    if (phase === "READY") {
      algoStatusBadge.textContent = "Gotowy (Centroidy zainicjalizowane)";
      algoStatusBadge.className = "font-bold text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700";
      phaseText.textContent = "Krok 0: Inicjalizacja";
      phaseDot.className = "w-2.5 h-2.5 rounded-full bg-slate-400";
    } else if (phase === "ASSIGNED") {
      algoStatusBadge.textContent = "Krok Przypisania (Assignment)";
      algoStatusBadge.className = "font-bold text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800";
      phaseText.textContent = "Krok 1: Przypisanie punktów do najbliższych centrów";
      phaseDot.className = "w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse";
    } else if (phase === "UPDATED") {
      algoStatusBadge.textContent = "Krok Aktualizacji (Centroid Shift)";
      algoStatusBadge.className = "font-bold text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800";
      phaseText.textContent = `Krok 2: Przeliczenie środków masy (Iteracja ${iteration})`;
      phaseDot.className = "w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse";
    } else if (phase === "CONVERGED") {
      algoStatusBadge.textContent = "✓ Zbieżność osiągnięta (Lokalne minimum)";
      algoStatusBadge.className = "font-bold text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 converged-pulse";
      phaseText.textContent = `✓ Zbieżność w ${iteration} iteracjach! (Δμ < 0.25px)`;
      phaseDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-600";
    }
  }

  // 4. Moduł 4: Obliczanie i Renderowanie Metody Łokcia & Sylwetki
  function updateDiagnosticPlots() {
    if (points.length < 8) return;

    // Szybka symulacja k-means dla k od 1 do 8
    const kRange = [1, 2, 3, 4, 5, 6, 7, 8];
    const elbowWcss = [];
    const silhouetteScores = [];

    kRange.forEach(targetK => {
      // 1. Uruchom 10 iteracji k-means dla targetK
      const res = runFastKmeans(points, targetK);
      elbowWcss.push(Math.round(res.wcss));

      // 2. Oblicz przybliżony Silhouette Score dla k >= 2
      if (targetK >= 2) {
        const sil = computeApproxSilhouette(points, res.centroids, res.labels);
        silhouetteScores.push(sil);
      }
    });

    // Wykres Metody Łokcia
    const elbowTrace = {
      x: kRange,
      y: elbowWcss,
      type: "scatter",
      mode: "lines+markers",
      name: "WCSS",
      line: { color: "#2563eb", width: 3 },
      marker: { color: "#1d4ed8", size: 8 }
    };

    // Zaznaczenie aktualnego wybranego k
    const currentKMarker = {
      x: [k],
      y: [elbowWcss[k - 1]],
      mode: "markers",
      marker: { color: "#e11d48", size: 14, symbol: "circle-open", line: { width: 3, color: "#e11d48" } },
      name: `Bieżące k=${k}`
    };

    const elbowLayout = {
      margin: { t: 20, r: 20, b: 35, l: 50 },
      xaxis: { title: "Liczba skupień (k)", dtick: 1, tickfont: { size: 11, family: "JetBrains Mono" } },
      yaxis: { title: "WCSS (Inertia)", tickfont: { size: 10, family: "JetBrains Mono" } },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      showlegend: false
    };

    Plotly.react("elbowPlot", [elbowTrace, currentKMarker], elbowLayout, { displayModeBar: false, responsive: true });

    // Wykres Sylwetki (Bar Chart dla k=2..8)
    const silTrace = {
      x: [2, 3, 4, 5, 6, 7, 8],
      y: silhouetteScores,
      type: "bar",
      marker: {
        color: [2, 3, 4, 5, 6, 7, 8].map(val => val === k ? "#059669" : "#cbd5e1")
      }
    };

    const silLayout = {
      margin: { t: 20, r: 20, b: 35, l: 40 },
      xaxis: { title: "Liczba skupień (k)", dtick: 1, tickfont: { size: 11, family: "JetBrains Mono" } },
      yaxis: { title: "Współczynnik Sylwetki", range: [0, 1], tickfont: { size: 10, family: "JetBrains Mono" } },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      showlegend: false
    };

    Plotly.react("silhouettePlot", [silTrace], silLayout, { displayModeBar: false, responsive: true });
  }

  // Pomocniczy szybki algorytm Lloyda
  function runFastKmeans(pts, numK, maxIter = 15) {
    if (pts.length === 0) return { wcss: 0, centroids: [], labels: [] };
    // Losowa inicjalizacja Forgy
    let centers = [];
    const used = new Set();
    while (centers.length < numK && centers.length < pts.length) {
      const idx = Math.floor(Math.random() * pts.length);
      if (!used.has(idx)) {
        used.add(idx);
        centers.push({ x: pts[idx].x, y: pts[idx].y });
      }
    }

    let labels = new Array(pts.length).fill(0);
    let finalWcss = 0;

    for (let it = 0; it < maxIter; it++) {
      finalWcss = 0;
      // Przypisanie
      for (let i = 0; i < pts.length; i++) {
        let minD = Infinity;
        let best = 0;
        for (let j = 0; j < centers.length; j++) {
          const d = distSq(pts[i], centers[j]);
          if (d < minD) {
            minD = d;
            best = j;
          }
        }
        labels[i] = best;
        finalWcss += minD;
      }

      // Aktualizacja
      const newCenters = [];
      for (let j = 0; j < centers.length; j++) {
        let sx = 0, sy = 0, count = 0;
        for (let i = 0; i < pts.length; i++) {
          if (labels[i] === j) {
            sx += pts[i].x;
            sy += pts[i].y;
            count++;
          }
        }
        newCenters.push(count > 0 ? { x: sx / count, y: sy / count } : centers[j]);
      }
      centers = newCenters;
    }

    return { wcss: finalWcss, centroids: centers, labels };
  }

  // Przybliżony Silhouette Score
  function computeApproxSilhouette(pts, centers, labels) {
    if (centers.length < 2) return 0;
    // Losowa podpróbka 50 punktów dla oszczędności CPU
    const sampleSize = Math.min(50, pts.length);
    let totalS = 0;

    for (let s = 0; s < sampleSize; s++) {
      const i = Math.floor(Math.random() * pts.length);
      const pi = pts[i];
      const myC = labels[i];

      // a(i): średnia odległość do punktów w tym samym klastrze
      let aSum = 0, aCount = 0;
      // b(i): minimalna średnia odległość do innego klastra
      const otherSums = new Array(centers.length).fill(0);
      const otherCounts = new Array(centers.length).fill(0);

      for (let j = 0; j < pts.length; j++) {
        if (i === j) continue;
        const d = Math.sqrt(distSq(pi, pts[j]));
        if (labels[j] === myC) {
          aSum += d;
          aCount++;
        } else {
          otherSums[labels[j]] += d;
          otherCounts[labels[j]]++;
        }
      }

      const a = aCount > 0 ? aSum / aCount : 0;
      let minB = Infinity;
      for (let c = 0; c < centers.length; c++) {
        if (c !== myC && otherCounts[c] > 0) {
          const bAvg = otherSums[c] / otherCounts[c];
          if (bAvg < minB) minB = bAvg;
        }
      }

      const denom = Math.max(a, minB);
      if (denom > 0) {
        totalS += (minB - a) / denom;
      }
    }

    return Math.max(0, Math.min(1, +(totalS / sampleSize).toFixed(2)));
  }

  // 5. Interaktywny Quiz (Moduł 5)
  const quizExplanations = {
    1: {
      correct: "✓ Znakomicie! Z warunku zerowania gradientu funkcji celu względem wektora centroidu bezpośrednio wynika wzór na średnią arytmetyczną punktów.",
      incorrect: "✗ Niestety. Średnia arytmetyczna punktów jest optymalnym punktem stacjonarnym wyłącznie dla sumy kwadratów odległości euklidesowych (L2^2). Dla odległości Manhattan (L1) środkiem ciężkości byłaby mediana (algorytm k-medians)."
    },
    2: {
      correct: "✓ Poprawnie! Algorytm Lloyda gwarantuje jedynie monotoniczny spadek WCSS i zbieżność do minimum lokalnego. Może utknąć w suboptymalnej konfiguracji, stąd konieczność stosowania k-means++ lub wielokrotnych restartów (n_init).",
      incorrect: "✗ Błąd. K-means jest heurystyką i NIE gwarantuje znalezienia globalnego minimum funkcji WCSS. Może zbiec do słabego minimum lokalnego."
    },
    3: {
      correct: "✓ Dokładnie! Losowanie z prawdopodobieństwem proporcjonalnym do kwadratu odległości D^2 zniechęca algorytm do wybierania centroidów leżących blisko siebie, rozpraszając je w naturalnych skupiskach.",
      incorrect: "✗ Błędna odpowiedź. Siła k-means++ leży w probabilistycznym mechanizmie D^2 sampling, który rozrzuca początkowe centroidy daleko od siebie."
    },
    4: {
      correct: "✓ Znakomita intuicja! Wartość ujemna s(i) < 0 oznacza, że odległość punktu do jego własnego klastra a(i) jest większa niż do klastra obcego b(i), co świadczy o błędnym przypisaniu.",
      incorrect: "✗ Niestety nie. Wartości dodatnie bliskie 1 oznaczają idealne dopasowanie. Wartość ujemna jednoznacznie wskazuje, że punkt leży bliżej klastra obcego niż swojego własnego."
    }
  };

  const quizState = { 1: false, 2: false, 3: false, 4: false };

  function setupQuiz() {
    const quizItems = document.querySelectorAll(".quiz-item");
    quizItems.forEach(item => {
      const qid = item.getAttribute("data-qid");
      const options = item.querySelectorAll(".quiz-option");
      const feedback = item.querySelector(".quiz-feedback");

      options.forEach(opt => {
        opt.addEventListener("click", () => {
          // Zablokuj dalsze klikanie w tym pytaniu
          options.forEach(o => o.classList.add("disabled", "pointer-events-none"));

          const isCorrect = opt.getAttribute("data-correct") === "true";
          if (isCorrect) {
            opt.classList.add("correct");
            feedback.className = "quiz-feedback p-3 rounded-lg text-xs leading-relaxed bg-emerald-50 text-emerald-900 border border-emerald-200 mt-2 block";
            feedback.textContent = quizExplanations[qid].correct;
            quizState[qid] = true;
          } else {
            opt.classList.add("incorrect");
            // Podświetl też poprawną
            options.forEach(o => {
              if (o.getAttribute("data-correct") === "true") o.classList.add("correct");
            });
            feedback.className = "quiz-feedback p-3 rounded-lg text-xs leading-relaxed bg-rose-50 text-rose-900 border border-rose-200 mt-2 block";
            feedback.textContent = quizExplanations[qid].incorrect;
            quizState[qid] = false;
          }

          // Przelicz wynik
          const score = Object.values(quizState).filter(Boolean).length;
          const scoreEl = document.getElementById("quizScoreText");
          scoreEl.textContent = `${score} / 4`;
          if (score === 4) {
            scoreEl.className = "text-base font-bold text-emerald-600 font-mono";
          }
        });
      });
    });
  }

  // 6. Kopiowanie Kodu Pythona (Moduł 6)
  function setupCodeCopy() {
    const copyBtn = document.getElementById("copyCodeBtn");
    const codeSnippet = document.getElementById("pythonCodeSnippet");
    const copyToast = document.getElementById("copyToast");

    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(codeSnippet.textContent).then(() => {
        copyToast.classList.remove("hidden");
        setTimeout(() => {
          copyToast.classList.add("hidden");
        }, 3000);
      });
    });
  }

  // 7. Event Listenery Kontrolek
  // Zmiana k
  kSlider.addEventListener("input", e => {
    k = parseInt(e.target.value, 10);
    kValBadge.textContent = k;
    resetCentroids();
    updateDiagnosticPlots();
  });

  // Metoda inicjalizacji
  initMethodSelect.addEventListener("change", e => {
    initMethod = e.target.value;
    resetCentroids();
  });

  // Przyciski kroków i symulacji
  stepBtn.addEventListener("click", () => {
    stopPlay();
    executeLloydStep();
  });

  playBtn.addEventListener("click", togglePlay);
  resetCentroidsBtn.addEventListener("click", resetCentroids);

  clearDataBtn.addEventListener("click", () => {
    stopPlay();
    points = [];
    centroids = [];
    wcssHistory = [];
    phase = "READY";
    iteration = 0;
    updateUI();
    renderCanvas();
    renderWcssChart();
    updateDiagnosticPlots();
  });

  // Kliknięcie na canvas dodaje punkt danych
  canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    points.push({ x, y, cluster: -1 });

    if (centroids.length === 0) {
      initCentroids();
    } else {
      phase = "READY";
    }
    updateUI();
    renderCanvas();
    updateDiagnosticPlots();
  });

  // Presety danych
  presetButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const presetType = btn.getAttribute("data-preset");
      generatePresetData(presetType);
    });
  });

  // Responsywność okna
  window.addEventListener("resize", () => {
    setupCanvasResolution();
  });

  // Start początkowy
  setupCanvasResolution();
  generatePresetData("gaussian");
  setupQuiz();
  setupCodeCopy();

  // Scrollspy dla lewego sidebara
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        document.querySelectorAll('.nav-link').forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('section[id]').forEach(sec => observer.observe(sec));
});

