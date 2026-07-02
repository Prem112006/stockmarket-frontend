
const getToken = () => localStorage.getItem('token');
const requireAuth = () => {
  const token = getToken();
  if (!token) {
    setMsg(msg, 'Please login to make predictions', 'error');
    return null;
  }
  return token;
};

const setMsg = (el, text, type) => {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error', 'success');
  if (type) el.classList.add(type);
  // Ensure message is shown or hidden explicitly
  if (text) {
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
};

const fmtMoney = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
};

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateAuthUI();
  setMsg(msg, 'Logged out successfully', 'success');
  setTimeout(() => setMsg(msg, 'Please login to make predictions', 'error'), 2000);
});

const form = document.getElementById('predictForm');
const msg = document.getElementById('predictMsg');

const allResultsContainer = document.getElementById('allResultsContainer');
const tabContainer = document.getElementById('tabContainer');
const symbolInput = document.getElementById('symbolInput');
const predictBtn = document.getElementById('predictBtn');

let charts = { lstm: null, finbert: null, rf: null, conclusion: null };

// Tab switching logic
document.querySelectorAll('.tab-item').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById(tab.dataset.target);
    if (target) {
        target.classList.add('active');
        
        // Force chart resize when tab becomes visible (fixes zero-width bug for hidden tabs)
        Object.keys(charts).forEach(key => {
            const chartObj = charts[key];
            const container = document.getElementById(`predictionChart_${key}`);
            if (chartObj && container && target.id === `tab_${key}`) {
               chartObj.applyOptions({ width: container.clientWidth || 600 });
               chartObj.timeScale().fitContent();
            }
        });
    }
  });
});

const createPredictionChart = (containerId, historyPoints = [], forecastPoints = []) => {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const chart = LightweightCharts.createChart(container, {
    width: container.clientWidth || 800,
    height: 320,
    layout: {
      backgroundColor: 'var(--bg)',
      textColor: 'var(--text)'
    },
    grid: {
      vertLines: { color: 'rgba(197, 203, 206, 0.5)' },
      horzLines: { color: 'rgba(197, 203, 206, 0.5)' }
    },
    rightPriceScale: { borderColor: 'rgba(197, 203, 206, 0.8)' },
    timeScale: { borderColor: 'rgba(197, 203, 206, 0.8)' }
  });

  const pastSeries = chart.addLineSeries({
    color: '#4ab0ff',
    lineWidth: 2
  });

  const futureSeries = chart.addLineSeries({
    color: '#f3b74a',
    lineWidth: 2,
    lineStyle: 2
  });

  const historyData = (historyPoints || []).map((pt) => ({
    time: pt.date,
    value: Number(pt.close ?? pt.value)
  }));
  const forecastData = (forecastPoints || []).map((pt) => ({
    time: pt.date,
    value: Number(pt.value)
  }));

  pastSeries.setData(historyData);
  futureSeries.setData(forecastData);

  chart.timeScale().fitContent();
  return chart;
};

const createConclusionChart = (containerId, historyPoints = [], forecasts = {}) => {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const chart = LightweightCharts.createChart(container, {
    width: container.clientWidth || 800,
    height: 380,
    layout: {
      backgroundColor: 'var(--bg)',
      textColor: 'var(--text)'
    },
    grid: {
      vertLines: { color: 'rgba(197, 203, 206, 0.5)' },
      horzLines: { color: 'rgba(197, 203, 206, 0.5)' }
    },
    rightPriceScale: { borderColor: 'rgba(197, 203, 206, 0.8)' },
    timeScale: { borderColor: 'rgba(197, 203, 206, 0.8)' }
  });

  const historySeries = chart.addLineSeries({ color: '#4ab0ff', lineWidth: 2 });
  const lstmSeries = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.6)', lineWidth: 1, lineStyle: 2 });
  const finbertSeries = chart.addLineSeries({ color: 'rgba(16, 185, 129, 0.6)', lineWidth: 1, lineStyle: 2 });
  const rfSeries = chart.addLineSeries({ color: 'rgba(245, 158, 11, 0.6)', lineWidth: 1, lineStyle: 2 });
  const consensusSeries = chart.addLineSeries({ color: '#d946ef', lineWidth: 3, lineStyle: 0 });

  const historyData = (historyPoints || []).map(pt => ({ time: pt.date, value: Number(pt.close ?? pt.value) }));
  historySeries.setData(historyData);

  if (forecasts.lstm?.length) lstmSeries.setData(forecasts.lstm.map(pt => ({ time: pt.date, value: Number(pt.value) })));
  if (forecasts.finbert?.length) finbertSeries.setData(forecasts.finbert.map(pt => ({ time: pt.date, value: Number(pt.value) })));
  if (forecasts.rf?.length) rfSeries.setData(forecasts.rf.map(pt => ({ time: pt.date, value: Number(pt.value) })));
  if (forecasts.consensus?.length) consensusSeries.setData(forecasts.consensus.map(pt => ({ time: pt.date, value: Number(pt.value) })));

  chart.timeScale().fitContent();
  return chart;
};

window.addEventListener('resize', () => {
  Object.keys(charts).forEach(key => {
    const chartObj = charts[key];
    const container = document.getElementById(`predictionChart_${key}`);
    if (chartObj && container) {
      chartObj.applyOptions({ width: container.clientWidth });
    }
  });
});

const formatMoneyLocal = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
};

// ---- Download CSV utility ----
const downloadPredictionCSV = (data, modelName) => {
  if (!data || data.error) return;
  const symbol = data.symbol || 'STOCK';
  const rows = [
    ['Stock Symbol', symbol],
    ['Stock Name', data.name || ''],
    ['Current Price (INR)', data.currentPrice || ''],
    ['Model', data.basis?.method || modelName],
    ['Confidence', data.confidence || ''],
    ['Trend', data.basis?.trend || ''],
    ['Sentiment', data.sentiment?.label || ''],
    ['Sentiment Score', data.sentiment?.score ?? ''],
    ['Sentiment Summary', data.sentiment?.summary || ''],
    [],
    ['--- PRICE FORECAST (20 BUSINESS DAYS) ---'],
    ['Date', 'Predicted Price (INR)'],
    ...(data.forecast || []).map(f => [f.date, Number(f.value).toFixed(2)]),
    [],
    ['--- KEY PREDICTIONS ---'],
    ['5-Day Price', data.predictions?.['5'] != null ? Number(data.predictions['5']).toFixed(2) : ''],
    ['10-Day Price', data.predictions?.['10'] != null ? Number(data.predictions['10']).toFixed(2) : ''],
    ['15-Day Price', data.predictions?.['15'] != null ? Number(data.predictions['15']).toFixed(2) : ''],
    ['20-Day Price', data.predictions?.['20'] != null ? Number(data.predictions['20']).toFixed(2) : ''],
    [],
    ['--- HISTORICAL DATA (Last 60 Days) ---'],
    ['Date', 'Open', 'High', 'Low', 'Close', 'Volume'],
    ...(data.history || []).map(h => [h.date, Number(h.open).toFixed(2), Number(h.high).toFixed(2), Number(h.low).toFixed(2), Number(h.close).toFixed(2), h.volume])
  ];

  const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${symbol}_${modelName}_prediction_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Store prediction data keyed by model suffix for download access
const predictionDataStore = {};

const generateTabHtml = (idSuffix, data) => {
  if (!data) return `<p style="padding: 20px; color: var(--text-muted);">Failed to load prediction for this model.</p>`;
  if (data.error) return `<p style="padding: 20px; color: #ef4444;">Error: ${data.error}</p>`;
  // Store data for download access
  predictionDataStore[idSuffix] = data;

  const supportLevels = data.supportResistance?.supportLevels || [];
  const resistanceLevels = data.supportResistance?.resistanceLevels || [];
  const sStr = supportLevels.length ? supportLevels.map(x => formatMoneyLocal(x)).join(' / ') : '—';
  const rStr = resistanceLevels.length ? resistanceLevels.map(x => formatMoneyLocal(x)).join(' / ') : '—';
  const trend = data.basis?.trend || '';
  const trendIcon = trend === 'Upward' ? '↗' : (trend === 'Downward' ? '↘' : '→');

  return `
    <div class="kpi-row" style="flex-wrap: wrap;">
      <div class="kpi">
        <div class="kpi-label">Confidence</div>
        <div class="kpi-value">${data.confidence || '—'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Trend</div>
        <div class="kpi-value">${trend} ${trendIcon}</div>
      </div>
    </div>

    <div class="support-resistance" style="margin-top: 16px;">
      <h3 style="margin: 0 0 10px; font-size: 1rem; color: var(--text-muted);">Support / Resistance</h3>
      <div class="kpi-row" style="flex-wrap: wrap; gap: 10px;">
        <div class="kpi-small">
          <div class="kpi-label">Support</div>
          <div class="kpi-value" style="font-size:0.95rem;">${sStr}</div>
        </div>
        <div class="kpi-small">
          <div class="kpi-label">Resistance</div>
          <div class="kpi-value" style="font-size:0.95rem;">${rStr}</div>
        </div>
      </div>
    </div>

    <h3 style="margin: 20px 0 10px; font-size: 1rem; color: var(--text-muted);">Future Price (Forecast)</h3>
    <div class="kpi-row" style="flex-wrap: wrap; gap: 15px;">
      <div class="kpi-small">
        <div class="kpi-label">5 Days</div>
        <div class="kpi-value predict-val">${formatMoneyLocal(data.predictions?.['5'])}</div>
      </div>
      <div class="kpi-small">
        <div class="kpi-label">10 Days</div>
        <div class="kpi-value predict-val">${formatMoneyLocal(data.predictions?.['10'])}</div>
      </div>
      <div class="kpi-small">
        <div class="kpi-label">15 Days</div>
        <div class="kpi-value predict-val">${formatMoneyLocal(data.predictions?.['15'])}</div>
      </div>
      <div class="kpi-small">
        <div class="kpi-label">20 Days</div>
        <div class="kpi-value predict-val">${formatMoneyLocal(data.predictions?.['20'])}</div>
      </div>
    </div>
    <p class="muted">${data.basis?.method || ''} | ${data.basis?.explanation || ''}</p>
    
    ${data.sentiment ? `
    <div class="sentiment-box" style="margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--border);">
      <h3 style="margin: 0 0 10px; font-size: 1rem; color: var(--text-muted);">Sentiment Analysis</h3>
      <p><strong>Sentiment:</strong> <span>${data.sentiment.label || '—'}</span></p>
      <p><strong>Score:</strong> <span>${data.sentiment.score != null ? data.sentiment.score : '—'}</span></p>
      <p><strong>Summary:</strong> <span>${data.sentiment.summary || '—'}</span></p>
    </div>
    ` : ''}

    <div id="predictionChart_${idSuffix}" style="height: 320px; margin-top: 18px; width:100%;"></div>

    <div style="margin-top: 18px; display: flex; gap: 12px; flex-wrap: wrap;">
      <button
        onclick="downloadPredictionCSV(predictionDataStore['${idSuffix}'], '${idSuffix}')"
        class="btn"
        style="background: linear-gradient(135deg,#1d4ed8,#3b82f6); color:#fff; display:flex; align-items:center; gap:8px; font-size:0.9rem; padding: 10px 20px; border-radius:8px; border:none; cursor:pointer;"
      >
        ⬇ Download CSV
      </button>
      <button
        onclick="downloadPredictionJSON(predictionDataStore['${idSuffix}'], '${idSuffix}')"
        class="btn btn-secondary"
        style="display:flex; align-items:center; gap:8px; font-size:0.9rem; padding: 10px 20px; border-radius:8px; cursor:pointer;"
      >
        ⬇ Download JSON
      </button>
    </div>
  `;
};

// Download JSON utility
const downloadPredictionJSON = (data, modelName) => {
  if (!data || data.error) return;
  const symbol = data.symbol || 'STOCK';
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${symbol}_${modelName}_prediction_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Download ALL model predictions as separate CSV files
const downloadAllPredictions = () => {
  const modelKeys = Object.keys(predictionDataStore);
  if (modelKeys.length === 0) return;
  modelKeys.forEach((key, idx) => {
    setTimeout(() => {
      downloadPredictionCSV(predictionDataStore[key], key);
    }, idx * 400); // 400ms stagger to prevent browser from blocking multiple downloads
  });
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = requireAuth();
  if (!token) return;

  const symbol = String(symbolInput.value || '').trim().toUpperCase();
  if (!symbol) return;

  setMsg(msg, 'Fetching predictions synchronously across 3 models (this may take up to 90 seconds)...', 'info');
  predictBtn.disabled = true;
  allResultsContainer.style.display = 'none';
  tabContainer.innerHTML = '';
  
  // Clean old charts if exist
  Object.keys(charts).forEach(k => {
    if (charts[k]) {
      charts[k].remove();
      charts[k] = null;
    }
  });

  const models = ['lstm', 'finbert', 'rf']; // align with 'rf' HTML suffix for DOM selection
  
  // Safely Set UI Loading spinners
  models.forEach(m => {
    const el = document.getElementById(`spinner_${m}`);
    if (el) el.innerText = '⏳';
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // Wait up to 3 mins for sequential processing

    // Pre-create empty tabs
    if (tabContainer) {
        tabContainer.innerHTML = `
          <div id="tab_lstm" class="tab-content active"><p style="padding: 20px; color: var(--text-muted);">Waiting in queue...</p></div>
          <div id="tab_finbert" class="tab-content"><p style="padding: 20px; color: var(--text-muted);">Waiting in queue...</p></div>
          <div id="tab_rf" class="tab-content"><p style="padding: 20px; color: var(--text-muted);">Waiting in queue...</p></div>
          <div id="tab_conclusion" class="tab-content"><p style="padding: 20px; color: var(--text-muted);">Waiting for models to finish...</p></div>
        `;
    }

    let historyPoints = [];
    const allForecasts = { lstm: [], finbert: [], rf: [], consensus: [] };
    
    // Clear overview safely
    ['current', 'lstm', 'finbert', 'rf'].forEach(key => {
        const el = document.getElementById(`overview_${key}`);
        if(el) el.textContent = '—';
    });

    if (allResultsContainer) allResultsContainer.style.display = 'block';
    
    const renderModel = (mod, data) => {
      // 1. Update Overview KPI
      const kpiEl = document.getElementById(`overview_${mod}`);
      if (kpiEl) kpiEl.textContent = data.predictions ? formatMoneyLocal(data.predictions['20']) : '—';
      
      const currentOverviewNode = document.getElementById('overview_current');
      if (currentOverviewNode && currentOverviewNode.textContent === '—' && data.currentPrice) {
          currentOverviewNode.textContent = formatMoneyLocal(data.currentPrice);
      }
      
      // Update Stock Symbol/Name header if missing
      const overviewLabel = document.getElementById('overview_stock_label');
      if (overviewLabel && data.symbol && (!overviewLabel.textContent || overviewLabel.textContent === '—')) {
          overviewLabel.textContent = `${data.symbol} - ${data.name || ''}`;
      }
      
      // 2. Render Tab HTML
      const container = document.getElementById(`tab_${mod}`);
      if (container) {
          container.innerHTML = generateTabHtml(mod, data);
          if (!data.error) {
              charts[mod] = createPredictionChart(`predictionChart_${mod}`, data.history, data.forecast);
          }
      }
    };

    // Sequential Fetch Loop
    for (const mod of models) {
        const spinner = document.getElementById(`spinner_${mod}`);
        if (spinner) spinner.innerText = '⏳ (Running...)';
        
        const tContainer = document.getElementById(`tab_${mod}`);
        if (tContainer) tContainer.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">Processing ${mod} prediction...</p>`;
        
        try {
            let apiModel = mod;
            if (mod === 'rf') apiModel = 'random_forest';
            
            const res = await fetch(`${API_BASE}/prediction/${encodeURIComponent(symbol)}?model=${encodeURIComponent(apiModel)}`, {
              signal: controller.signal
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'API request failed');
            
            renderModel(mod, data);
            if (data.history?.length > historyPoints.length) historyPoints = data.history;
            if (data.forecast?.length) allForecasts[mod] = data.forecast;
            if (spinner) spinner.innerText = '✅';
        } catch (err) {
            let errorMsg = err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Failed');
            renderModel(mod, { error: errorMsg });
            if (spinner) spinner.innerText = '❌';
        }
    }

    clearTimeout(timeoutId);

    // Compute Consensus
    const conclusionSpinner = document.getElementById('spinner_conclusion');
    const conclusionTab = document.getElementById('tab_conclusion');
    
    if (conclusionSpinner) conclusionSpinner.innerText = '⏳';
    
    // Average the valid forecasts
    const allDates = [...new Set(Object.values(allForecasts).flat().map(v => v.date))].sort();
    allDates.forEach(date => {
      let sum = 0, count = 0;
      ['lstm', 'finbert', 'rf'].forEach(m => {
        const pt = allForecasts[m].find(p => p.date === date);
        if (pt) { sum += Number(pt.value); count++; }
      });
      if (count > 0) allForecasts.consensus.push({ date, value: sum / count });
    });

    if (conclusionTab) {
      if (allForecasts.consensus.length > 0) {
        conclusionTab.innerHTML = `
          <div class="kpi-row" style="flex-wrap: wrap;">
            <div class="kpi">
              <div class="kpi-label">Consensus</div>
              <div class="kpi-value">Averaged from all successful models</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">20-Day Target</div>
              <div class="kpi-value predict-val">${formatMoneyLocal(allForecasts.consensus[allForecasts.consensus.length - 1].value)}</div>
            </div>
          </div>
          <div id="predictionChart_conclusion" style="height: 380px; margin-top: 18px; width:100%;"></div>
        `;
        charts.conclusion = createConclusionChart('predictionChart_conclusion', historyPoints, allForecasts);
        if (conclusionSpinner) conclusionSpinner.innerText = '✅';
      } else {
        conclusionTab.innerHTML = '<p style="padding: 20px; color: var(--text-muted);">Failed to calculate conclusion. Need at least one model forecast.</p>';
        if (conclusionSpinner) conclusionSpinner.innerText = '❌';
      }
    }
    setMsg(msg, 'All predictions have been gathered!', 'success');
    // Show the Download All CSVs button
    const dlAllBtn = document.getElementById('downloadAllBtn');
    if (dlAllBtn) dlAllBtn.style.display = 'flex';

  } catch (err) {
    setMsg(msg, 'An unexpected error occurred: ' + (err.message || ''), 'error');
  } finally {
    if (predictBtn) predictBtn.disabled = false;
  }
});

const updateAuthUI = () => {
  const token = getToken();
  const user = getUser();

  if (token && user) {
    // User is logged in
    authButtons.style.display = 'none';
    profileBtn.style.display = 'block';
    logoutBtn.style.display = 'block';
    if (user.name) {
      document.getElementById('profileInitial').textContent = user.name.charAt(0).toUpperCase();
    }
  } else {
    // User is not logged in
    authButtons.style.display = 'flex';
    profileBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
  }
};

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
};

const authButtons = document.getElementById('authButtons');
const profileBtn = document.getElementById('profileBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Initialize authentication UI
updateAuthUI();

const token = getToken();
if (!token) {
  setMsg(msg, 'Please login to make predictions', 'error');
  result.style.display = 'none';
}

// Theme toggle functionality (keep theme persistent across pages)
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

const setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
};

const toggleTheme = () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
};

const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}
