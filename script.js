/* =========================================================================
   PHANTASMA — script.js
   Vanilla JS only. No frameworks. No dependencies.
   ========================================================================= */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     CASE DATA — all 6 case studies
     --------------------------------------------------------------------- */
  const CASES = [
    {
      slug: 'ecommerce-cost-engine',
      area: 'case1',
      tileSize: '1x1',
      industry: 'E-commerce',
      title: 'E-commerce Cost Engine',
      outcome: 'From 80 hours of manual COGS to 5 hours, on €60/month cloud.',
      kpiNum: '93.7%',
      kpiLabel: 'labor reduction',
      heroMetric: { kind: 'numeric', value: '93.7%', label: 'labor reduction', foil: '80 hrs → 5 hrs per cycle' },
      situation: {
        prose:
          'The accounting team spent five days every cycle calculating COGS across thousands of SKUs and dozens of manufacturers. Pricing rules varied per contract. Marketplace commissions varied per category. Logistics rates varied per product. Three senior employees were tied up reconciling spreadsheets.',
        scale: [
          { num: '8,000', label: 'SKUs' },
          { num: '20', label: 'manufacturers' },
          { num: '80 hrs', label: 'per cycle' },
          { num: '5 days', label: 'turnaround' },
          { num: '3', label: 'senior FTEs' },
        ],
      },
      built: {
        rows: [
          [
            { label: 'Sales APIs (Amazon, Shopify)' },
            { arrow: true },
            { label: 'Data Lake (ADLS Gen2, JSON/CSV/Parquet)' },
            { arrow: true },
            { label: 'SQL Data Warehouse (star schema)' },
          ],
          [
            { label: 'Power App for logistics rates' },
            { arrow: true },
            { label: 'COGS engine (Azure ETL)' },
            { arrow: true },
            { label: 'Paginated Reports + invoices' },
          ],
        ],
        caption:
          'A single source of truth that pulls from your sales channels, normalises pricing per contract, and emits client-ready invoices. A small Power App lets logistics update delivery rates without touching code.',
      },
      impact: {
        type: 'table',
        headers: ['Before', 'After'],
        rows: [
          ['Total time', '80 hrs', '5 hrs'],
          ['Turnaround', '5 days', '2 days'],
          ['Operational cost', '3 senior FTEs', '€60/mo + 5 QA hrs'],
          ['Scalability', 'Linear (more SKUs = more staff)', 'Exponential (no bottleneck)'],
        ],
      },
      stack: ['Azure Data Factory', 'ADLS Gen2', 'MSSQL', 'Power BI', 'Power Apps', 'Azure ML', 'Google Sheets bridge'],
      engagement: { duration: '~3 months', tco: '€60 / month operating cost', summary: 'Replaces ~75 hours of senior FTE time per cycle.' },
    },

    {
      slug: 'mining-operational-intelligence',
      area: 'case2',
      tileSize: '2x1',
      industry: 'Mining & raw materials',
      title: 'Industrial Scale-Up & Operational Intelligence',
      outcome: 'Unified ETL, AI-driven OCR, governed dashboards across acquired sites.',
      kpiNum: '700%',
      kpiLabel: 'monthly throughput',
      heroMetric: { kind: 'numeric', value: '700%', label: 'monthly task capacity', foil: '40 → 280 tasks per month across sites' },
      situation: {
        prose:
          'A series of acquisitions left the client with disconnected mining sites — each running its own spreadsheets, accounting software, and paper invoices. Land acquisition, mining, and ecological restoration ran on separate processes. Cash flows sat with individual accountants.',
        scale: [
          { num: '6', label: 'acquired sites' },
          { num: '40 → 280', label: 'tasks per month' },
          { num: '3,500 → 11,000', label: 'units of raw material' },
          { num: '< 10%', label: 'data accessibility (before)' },
        ],
      },
      built: {
        rows: [
          [
            { label: 'Accounting API + ClickUp API' },
            { arrow: true },
            { label: 'Azure Data Factory + Databricks' },
            { arrow: true },
            { label: 'Centralized Data Warehouse' },
          ],
          [
            { label: 'Paper invoices' },
            { arrow: true },
            { label: 'Azure ML OCR' },
            { arrow: true },
            { label: 'Auto-mapped to project tasks' },
          ],
          [
            { label: 'SharePoint (governance)' },
            { arrow: true },
            { label: 'Power BI executive snapshots' },
            { arrow: true },
            { label: 'Power Apps for site teams' },
          ],
        ],
        caption:
          'Every operational task — from land acquisition to vegetation restoration — links to its financial cash flow. Weekly automated reports flag what is behind schedule before a manager has to ask.',
      },
      impact: {
        type: 'table',
        headers: ['Before', 'After'],
        rows: [
          ['Monthly task capacity', '40 tasks', '280 tasks'],
          ['Raw material units', '3,500', '11,000'],
          ['Labour inefficiency', '650 hrs / month', '300 hrs / month'],
          ['Data accessibility', 'Under 10%', '~80% organisation-wide'],
        ],
      },
      stack: ['Azure Databricks', 'Azure Data Factory', 'Azure Machine Learning', 'Power BI', 'Power Apps', 'SharePoint', 'ClickUp API', 'Azure AD / RLS'],
      engagement: { duration: '~18 months', tco: '€15K total cost over 2 years (cloud + IT support)', summary: 'Removed the specialist bottleneck across six acquired sites.' },
    },

    {
      slug: 'monolith-recovery',
      area: 'case3',
      tileSize: '2x1',
      industry: 'E-commerce platform',
      title: 'Monolith → Microservices Recovery',
      outcome: 'PHP monolith decommissioned. Decoupled Azure microservices in its place.',
      kpiNum: 'CI/CD',
      kpiLabel: 'governed releases',
      heroMetric: {
        kind: 'headline',
        before: 'From debugging marathons that lasted weeks',
        after: 'to CI/CD-governed releases.',
      },
      situation: {
        prose:
          'A previous attempt to centralize operations had been built as a single PHP monolith — every function from ETL to API auth to reporting in one codebase. Minor changes triggered weeks of regression debugging. Only the original author could navigate the system. Reports were hard-coded in Python with no visualization layer.',
        scale: [
          { num: '1', label: 'monolithic codebase' },
          { num: '~0', label: 'documentation' },
          { num: 'Weeks', label: 'per debug cycle' },
          { num: 'Senior dev', label: 'required for any KPI change' },
        ],
      },
      built: {
        rows: [
          [
            { label: 'Amazon + Shopify APIs' },
            { arrow: true },
            { label: 'ADF + ADLS Bronze layer' },
            { arrow: true },
            { label: 'Databricks (Spark)' },
          ],
          [
            { label: 'Azure SQL DW (Single Source)' },
            { arrow: true },
            { label: 'Power BI (self-service)' },
            { arrow: true },
            { label: 'Stakeholder dashboards' },
          ],
          [
            { label: 'Azure DevOps CI/CD' },
            { arrow: true },
            { label: 'Dev / Staging / Production' },
            { arrow: true },
            { label: 'Tested before deploy' },
          ],
        ],
        caption:
          'A microservices-oriented architecture: the failure of one component cannot bring down the rest. Bronze data layer means schema changes can be reprocessed without re-fetching the source.',
      },
      impact: {
        type: 'tiles',
        tiles: [
          { num: 'Resolved', label: 'operational fragility — isolated services, no cascading regressions' },
          { num: 'Eliminated', label: 'knowledge silos — modular, documented, replicable' },
          { num: 'Self-service', label: 'reporting — non-technical stakeholders own their dashboards' },
          { num: 'Spark-grade', label: 'compute — handles loads the PHP scripts could not' },
        ],
      },
      stack: ['Azure Data Factory', 'Azure Databricks', 'MSSQL', 'Azure SQL', 'Power BI', 'Azure DevOps', 'Terraform / Bicep', 'Azure AD / Entra ID', 'ClickUp'],
      engagement: { duration: '~6 months', tco: 'Replaces failing monolith — operating cost dropped to standard Azure-native run rates', summary: 'Forensic audit, then a complete decoupled rebuild.' },
    },

    {
      slug: 'precision-viticulture',
      area: 'case4',
      tileSize: '1x1',
      industry: 'Agriculture',
      title: 'Precision Viticulture IoT',
      outcome: 'Closed-loop irrigation across 12 hectares — river to summit.',
      kpiNum: '12 ha',
      kpiLabel: 'autonomous',
      heroMetric: { kind: 'numeric', value: '12 ha', label: 'autonomous, weather-aware irrigation', foil: 'River-to-summit, closed-loop' },
      situation: {
        prose:
          'A 12-hectare vineyard on rugged mountain terrain needed precision irrigation. Water had to be pumped from a river up the slope into reservoirs, then gravity-fed through kilometers of hose. Soil chemistry, moisture, and weather all mattered — and none of it was being measured.',
        scale: [
          { num: '12 ha', label: 'vineyard terrain' },
          { num: 'NPK', label: 'soil chemistry monitoring' },
          { num: 'pH', label: 'soil balance tracking' },
          { num: 'km', label: 'of hose droppers' },
        ],
      },
      built: {
        rows: [
          [
            { label: 'IoT sensors (soil NPK, moisture, temp)' },
            { arrow: true },
            { label: 'On-prem edge hub (low-power, always-on)' },
            { arrow: true },
            { label: 'Azure Data Factory + Databricks' },
          ],
          [
            { label: 'Weather Forecast APIs' },
            { arrow: true },
            { label: 'Predictive irrigation model' },
            { arrow: true },
            { label: 'Automated pumping station' },
          ],
        ],
        caption:
          'Agronomic research first — defining the optimal moisture window for sugar content, the ideal NPK ratios, the soil pH range. Then sensors, edge hub, cloud, and pumps wired into one closed loop.',
      },
      impact: {
        type: 'tiles',
        tiles: [
          { num: 'Closed-loop', label: 'autonomy — system maintains optimal moisture without operator intervention' },
          { num: 'Weather-aware', label: 'pumping — minimizes energy by skipping cycles before predicted rainfall' },
          { num: 'Targeted', label: 'fertigation — NPK delivery matches sensor-confirmed soil needs' },
          { num: 'Resilient', label: 'connectivity — on-prem hub keeps the loop alive in remote terrain' },
        ],
      },
      stack: ['IoT (custom sensors)', 'On-prem edge server', 'Azure Data Factory', 'Azure Databricks', 'Weather APIs', 'Predictive ML'],
      engagement: { duration: '~9 months including agronomic research', tco: 'Hardware + cloud + edge support', summary: 'Research, hardware design, deployment, and pump automation in one engagement.' },
    },

    {
      slug: 'pharmacy-digitalisation',
      area: 'case5',
      tileSize: '2x1',
      industry: 'Pharmacy & healthcare',
      title: 'Pharmacy Chain Digital Transformation',
      outcome: 'From a 20-year-old ERP to GDP-compliant, AI-mapped, IoT-monitored.',
      kpiNum: '6 stores · 20 yrs',
      kpiLabel: 'data unified',
      heroMetric: { kind: 'numeric', value: '6 stores · 20 yrs', label: 'of legacy data unified, GDP-compliant', foil: 'Across the chain, all branches' },
      situation: {
        prose:
          'A 6-store pharmacy chain had to align with new Georgian healthcare regulations. Two decades of fragmented data lived in a 20-year-old ERP. Product naming and categorization varied across the Ministry of Health, Revenue Service, logistics databases, and historical invoices.',
        scale: [
          { num: '6', label: 'stores' },
          { num: '20 years', label: 'of legacy ERP data' },
          { num: '4', label: 'authoritative data sources' },
          { num: 'GDP', label: 'compliance required' },
        ],
      },
      built: {
        rows: [
          [
            { label: 'Ministry of Health + Revenue + logistics + invoices' },
            { arrow: true },
            { label: 'AI product mapping' },
            { arrow: true },
            { label: 'Central Product Library' },
          ],
          [
            { label: 'New ERP' },
            { arrow: true },
            { label: 'Custom Data Warehouse' },
            { arrow: true },
            { label: 'Sales prediction + auto-procurement' },
          ],
          [
            { label: 'IoT temp/humidity sensors (6 sites)' },
            { arrow: true },
            { label: 'Centralized monitoring' },
            { arrow: true },
            { label: 'Automated MOH reporting' },
          ],
        ],
        caption:
          'AI parses and matches medicinal names across four authoritative sources, eliminating manual entry errors. IoT keeps every store within GDP-mandated environmental conditions. Reporting to the Ministry is automated.',
      },
      impact: {
        type: 'tiles',
        tiles: [
          { num: 'Unified', label: '20 years of legacy ERP data into a single normalized library' },
          { num: 'GDP/GMP', label: 'compliant temperature & humidity monitoring across all 6 stores' },
          { num: 'Predictive', label: 'auto-procurement based on real-time sales velocity per branch' },
          { num: 'Real-time', label: 'mandatory reporting to the Ministry of Health, no manual filing' },
        ],
      },
      stack: ['Custom Data Warehouse', 'AI mapping toolchain', 'IoT sensors', 'New ERP integration', 'Google Workspace', 'HubSpot'],
      engagement: { duration: '~12 months', tco: 'On-prem + cloud hybrid; details per branch', summary: 'Migration, mapping, IoT rollout, and regulatory automation in one programme.' },
    },

    {
      slug: 'demand-forecasting',
      area: 'case6',
      tileSize: '2x2',
      industry: 'E-commerce distribution',
      title: 'Demand Forecasting Engine',
      outcome:
        'Predictive replenishment for 12,000 SKUs across 200 brands. Built on Azure ML, validated against four years of historical sales.',
      kpiNum: '98%',
      kpiLabel: 'forecast accuracy',
      kpiFoil: 'vs. 81% human baseline',
      heroMetric: {
        kind: 'numeric',
        value: '98%',
        label: 'forecast accuracy',
        foil: 'vs. 81% human procurement baseline',
      },
      situation: {
        prose:
          'A large e-commerce distributor managed 12,000 SKUs across 200 brands and 40 manufacturers. Sales and inventory data were siloed across multiple platforms. Logistics differed by SKU — packaging, expiry, dimensions, weight. Manual stock management led to constant overstocking and understocking.',
        scale: [
          { num: '12,000', label: 'SKUs' },
          { num: '200', label: 'brands' },
          { num: '40', label: 'manufacturers' },
          { num: '4 years', label: 'of historical data' },
        ],
      },
      built: {
        rows: [
          [
            { label: 'Shopify + Amazon SP-API + market trends' },
            { arrow: true },
            { label: 'Azure Data Factory + Databricks' },
            { arrow: true },
            { label: 'MSSQL Data Warehouse' },
          ],
          [
            { label: 'Feature engineering (rolling 7/30/90, YoY, category trends)' },
            { arrow: true },
            { label: 'Azure ML forecasting' },
            { arrow: true },
            { label: 'Automated replenishment suggestions' },
          ],
        ],
        caption:
          'Sales channels unified into a "golden record" table. Logistical metadata standardised. Forecasts engineered against rolling windows and external market signals. Replenishment recommendations are generated automatically per SKU.',
      },
      impact: {
        type: 'table',
        headers: ['Before', 'After'],
        rows: [
          ['Forecast accuracy (clean data)', '~94%', '98%'],
          ['Human baseline accuracy', '81%', '—'],
          ['Manual labour', 'Constant', 'Automated invoices + listings'],
          ['Stockouts / overstocks', 'Frequent', 'Materially reduced'],
        ],
      },
      stack: ['Azure Data Factory', 'Azure Databricks', 'Azure Machine Learning', 'MSSQL', 'Shopify API', 'Amazon SP-API', 'External market trend APIs', 'Python · SQL'],
      engagement: { duration: '~8 months', tco: 'Operational on Azure-native run rates', summary: 'Outperformed human procurement specialists in backtesting against 4 years of history.' },
    },
  ];

  /* ---------------------------------------------------------------------
     Hero load reveal
     --------------------------------------------------------------------- */
  function bootHeroReveal() {
    document.documentElement.classList.add('js-loading');

    // Wrap each line's content in a span for clip-style reveal
    document.querySelectorAll('.hero__line').forEach((el) => {
      const text = el.textContent;
      el.textContent = '';
      const inner = document.createElement('span');
      inner.textContent = text;
      el.appendChild(inner);
    });

    const finishReveal = () => {
      document.documentElement.classList.remove('js-loading');
      document.body.classList.add('is-revealed');
      // Trigger count-up after reveal
      setTimeout(triggerCountUp, prefersReducedMotion ? 0 : 360);
    };

    if (document.fonts && document.fonts.ready) {
      Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 800)),
      ]).then(finishReveal);
    } else {
      setTimeout(finishReveal, 100);
    }
  }

  function triggerCountUp() {
    if (prefersReducedMotion) return;
    document.querySelectorAll('[data-count-to]').forEach((el, i) => {
      const target = parseFloat(el.dataset.countTo);
      const suffix = el.dataset.suffix || '';
      const duration = 280;
      const startTime = performance.now() + i * 60;
      const decimals = (el.dataset.countTo.split('.')[1] || '').length;

      el.textContent = '0' + suffix;

      function frame(now) {
        const elapsed = now - startTime;
        if (elapsed < 0) {
          requestAnimationFrame(frame);
          return;
        }
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = target * eased;
        el.textContent = value.toFixed(decimals) + suffix;
        if (progress < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  /* ---------------------------------------------------------------------
     Header scroll behavior
     --------------------------------------------------------------------- */
  function bootHeader() {
    const header = document.getElementById('site-header');
    let scrolled = false;
    function update() {
      const isScrolled = window.scrollY > 80;
      if (isScrolled !== scrolled) {
        scrolled = isScrolled;
        header.classList.toggle('is-scrolled', scrolled);
      }
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* ---------------------------------------------------------------------
     Bento — render tiles
     --------------------------------------------------------------------- */
  function renderBento() {
    const bento = document.getElementById('bento');
    bento.innerHTML = '';

    // Render in declared order; CSS grid-area places them visually
    CASES.forEach((c) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.dataset.area = c.area;
      tile.dataset.caseSlug = c.slug;
      tile.setAttribute('aria-label', `Open case study: ${c.title}`);

      let kpiHtml;
      if (c.kpiFoil) {
        kpiHtml = `<span class="tile__kpi"><strong>${c.kpiNum}</strong>${c.kpiLabel}</span>`;
      } else {
        kpiHtml = `<span class="tile__kpi"><strong>${c.kpiNum}</strong>${c.kpiLabel}</span>`;
      }

      const heroPair =
        c.tileSize === '2x2'
          ? `<div class="tile__hero-pair">
               <span class="tile__hero-num">${c.kpiNum}</span>
               <span class="tile__hero-foil">${c.kpiFoil || ''}</span>
             </div>`
          : '';

      tile.innerHTML = `
        <span class="tile__chip">${c.industry}</span>
        <h3 class="tile__title">${c.title}</h3>
        <p class="tile__outcome">${c.outcome}</p>
        ${heroPair}
        <div class="tile__bottom">
          ${kpiHtml}
          <span class="tile__open" aria-hidden="true">Open →</span>
        </div>
      `;

      tile.addEventListener('click', () => Lightbox.open(c.slug));
      bento.appendChild(tile);
    });
  }

  /* ---------------------------------------------------------------------
     Lightbox
     --------------------------------------------------------------------- */
  const Lightbox = (function () {
    let caseIndex = 0;
    let slideIndex = 0;
    let isOpen = false;
    let lastFocused = null;
    let isAnimating = false;

    const root = document.getElementById('lightbox');
    const container = document.getElementById('lightbox-container');
    const stage = document.getElementById('lightbox-stage');
    const dotsEl = document.getElementById('lightbox-dots');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');
    const counter = document.getElementById('lightbox-case-counter');
    const slideCounter = document.getElementById('lightbox-slide-counter');
    const announce = document.getElementById('lightbox-announce');
    const hint = document.getElementById('lightbox-hint');

    const SLIDE_LABELS = ['Cover', 'The Situation', 'What we built', 'Impact', 'Stack & Engagement'];

    function open(slug) {
      if (isAnimating || isOpen) return;
      const idx = CASES.findIndex((c) => c.slug === slug);
      if (idx === -1) return;
      caseIndex = idx;
      slideIndex = 0;
      isOpen = true;
      lastFocused = document.activeElement;

      const tile = document.querySelector(`[data-case-slug="${slug}"]`);
      const tileRect = tile.getBoundingClientRect();

      // Render content first so we can measure
      render();

      // Show lightbox
      root.hidden = false;
      document.body.classList.add('is-locked');

      // Compute FLIP transform: lightbox -> tile rect on initial frame
      requestAnimationFrame(() => {
        const targetRect = container.getBoundingClientRect();
        const sx = tileRect.width / targetRect.width;
        const sy = tileRect.height / targetRect.height;
        const tx = (tileRect.left + tileRect.width / 2) - (targetRect.left + targetRect.width / 2);
        const ty = (tileRect.top + tileRect.height / 2) - (targetRect.top + targetRect.height / 2);

        if (prefersReducedMotion) {
          root.classList.add('is-open');
          finishOpen();
        } else {
          isAnimating = true;
          container.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
          container.style.transformOrigin = 'center';
          // Force reflow
          // eslint-disable-next-line no-unused-expressions
          container.offsetHeight;
          requestAnimationFrame(() => {
            root.classList.add('is-open', 'is-animating');
            container.style.transform = 'translate(0, 0) scale(1, 1)';
            container.addEventListener('transitionend', function once() {
              container.removeEventListener('transitionend', once);
              container.style.transform = '';
              root.classList.remove('is-animating');
              isAnimating = false;
              finishOpen();
            }, { once: true });
          });
        }
      });
    }

    function finishOpen() {
      maybeShowHint();
      const focusable = root.querySelector('.lightbox__close');
      if (focusable) focusable.focus({ preventScroll: true });
    }

    function close() {
      if (!isOpen || isAnimating) return;
      const tile = document.querySelector(`[data-case-slug="${CASES[caseIndex].slug}"]`);
      if (!tile) {
        teardown();
        return;
      }
      const tileRect = tile.getBoundingClientRect();
      const targetRect = container.getBoundingClientRect();
      const sx = tileRect.width / targetRect.width;
      const sy = tileRect.height / targetRect.height;
      const tx = (tileRect.left + tileRect.width / 2) - (targetRect.left + targetRect.width / 2);
      const ty = (tileRect.top + tileRect.height / 2) - (targetRect.top + targetRect.height / 2);

      if (prefersReducedMotion) {
        teardown();
      } else {
        isAnimating = true;
        root.classList.add('is-animating');
        root.classList.remove('is-open');
        container.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
        container.addEventListener('transitionend', function once() {
          container.removeEventListener('transitionend', once);
          teardown();
        }, { once: true });
        // Backdrop fades alongside via the .is-open removal
      }
    }

    function teardown() {
      root.hidden = true;
      root.classList.remove('is-open', 'is-animating');
      container.style.transform = '';
      document.body.classList.remove('is-locked');
      isOpen = false;
      isAnimating = false;
      if (lastFocused && lastFocused.focus) {
        lastFocused.focus({ preventScroll: false });
      }
    }

    function maybeShowHint() {
      if (sessionStorage.getItem('phantasma:hint-seen')) return;
      hint.hidden = false;
      const hide = () => {
        hint.hidden = true;
        sessionStorage.setItem('phantasma:hint-seen', '1');
      };
      setTimeout(hide, 4000);
      const opts = { once: true };
      document.addEventListener('keydown', hide, opts);
    }

    function nextSlide() {
      if (slideIndex < 4) {
        slideIndex++;
        render();
      }
    }
    function prevSlide() {
      if (slideIndex > 0) {
        slideIndex--;
        render();
      }
    }
    function goToSlide(i) {
      slideIndex = Math.max(0, Math.min(4, i));
      render();
    }
    function nextCase() {
      caseIndex = (caseIndex + 1) % CASES.length;
      slideIndex = 0;
      render(true);
    }
    function prevCase() {
      caseIndex = (caseIndex - 1 + CASES.length) % CASES.length;
      slideIndex = 0;
      render(true);
    }

    function render(announceCase = false) {
      const c = CASES[caseIndex];

      counter.textContent = `Case ${String(caseIndex + 1).padStart(2, '0')} of ${String(CASES.length).padStart(2, '0')}`;
      slideCounter.innerHTML =
        `<strong>${String(slideIndex + 1).padStart(2, '0')}</strong> / 05`;

      // Slide content
      stage.innerHTML = renderSlide(c, slideIndex);
      stage.querySelector('.slide').classList.add('is-active');

      // Dots
      dotsEl.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-label', `Go to slide ${i + 1}: ${SLIDE_LABELS[i]}`);
        if (i === slideIndex) btn.classList.add('is-active');
        btn.addEventListener('click', () => goToSlide(i));
        li.appendChild(btn);
        dotsEl.appendChild(li);
      }

      // Nav buttons
      prevBtn.disabled = slideIndex === 0;
      nextBtn.disabled = slideIndex === 4;

      // Announce
      if (announceCase) {
        announce.textContent = `Now viewing case ${caseIndex + 1} of ${CASES.length}: ${c.title}`;
      } else {
        announce.textContent = `Slide ${slideIndex + 1} of 5: ${SLIDE_LABELS[slideIndex]}`;
      }
    }

    function renderSlide(c, idx) {
      switch (idx) {
        case 0: return slideCover(c);
        case 1: return slideSituation(c);
        case 2: return slideBuilt(c);
        case 3: return slideImpact(c);
        case 4: return slideStack(c);
      }
      return '';
    }

    function slideCover(c) {
      let heroBlock;
      if (c.heroMetric.kind === 'numeric') {
        heroBlock = `
          <div class="slide-cover__hero">
            <p class="slide-cover__num">${c.heroMetric.value}</p>
            <div>
              <p class="slide-cover__num-label">${c.heroMetric.label}</p>
              ${c.heroMetric.foil ? `<p class="slide-cover__num-foil">${c.heroMetric.foil}</p>` : ''}
            </div>
          </div>
        `;
      } else {
        heroBlock = `
          <div class="slide-cover__headline">
            <p class="slide-cover__headline-before">${c.heroMetric.before}</p>
            <p class="slide-cover__headline-after">${c.heroMetric.after}</p>
          </div>
        `;
      }
      return `
        <article class="slide" id="slide-active">
          <span class="slide__chip">${c.industry}</span>
          <h2 class="slide__h" id="lightbox-title">${c.title}</h2>
          <p class="slide__lead">${c.outcome}</p>
          ${heroBlock}
        </article>
      `;
    }

    function slideSituation(c) {
      const scaleRows = c.situation.scale
        .map(
          (r) =>
            `<div class="scale-row"><span class="scale-row__num">${r.num}</span><span class="scale-row__label">${r.label}</span></div>`
        )
        .join('');
      return `
        <article class="slide">
          <span class="slide__chip">${c.industry}</span>
          <h2 class="slide__h">The Situation</h2>
          <div class="slide-situation">
            <div class="slide-situation__prose">
              <p>${c.situation.prose}</p>
            </div>
            <aside class="slide-situation__scale">
              <p class="slide-situation__scale-h">Scale</p>
              ${scaleRows}
            </aside>
          </div>
        </article>
      `;
    }

    function slideBuilt(c) {
      const rows = c.built.rows
        .map((row) => {
          const inner = row
            .map((b) => {
              if (b.arrow) {
                return `<span class="diagram-arrow" aria-hidden="true">→</span>`;
              }
              return `<div class="diagram-box">${b.label}</div>`;
            })
            .join('');
          return `<div class="slide-built__row">${inner}</div>`;
        })
        .join('');
      return `
        <article class="slide">
          <span class="slide__chip">${c.industry}</span>
          <h2 class="slide__h">What we built</h2>
          <div class="slide-built__diagram">${rows}</div>
          <p class="slide-built__caption">${c.built.caption}</p>
        </article>
      `;
    }

    function slideImpact(c) {
      let body;
      if (c.impact.type === 'table') {
        const headers = c.impact.headers
          .map((h) => `<th scope="col">${h}</th>`)
          .join('');
        const rows = c.impact.rows
          .map((r) => {
            const [label, ...cells] = r;
            const tds = cells.map((cell) => `<td>${cell}</td>`).join('');
            return `<tr><th scope="row">${label}</th>${tds}</tr>`;
          })
          .join('');
        body = `
          <table class="slide-impact__table">
            <thead>
              <tr><th></th>${headers}</tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `;
      } else {
        const tiles = c.impact.tiles
          .map(
            (t) =>
              `<div class="slide-impact__tile"><p class="slide-impact__tile-num">${t.num}</p><p class="slide-impact__tile-label">${t.label}</p></div>`
          )
          .join('');
        body = `<div class="slide-impact__tiles">${tiles}</div>`;
      }

      return `
        <article class="slide">
          <span class="slide__chip">${c.industry}</span>
          <h2 class="slide__h">Impact</h2>
          ${body}
        </article>
      `;
    }

    function slideStack(c) {
      const chips = c.stack.map((s) => `<li class="chip">${s}</li>`).join('');
      return `
        <article class="slide">
          <span class="slide__chip">${c.industry}</span>
          <h2 class="slide__h">Stack & Engagement</h2>
          <div class="slide-stack">
            <div>
              <p class="slide-situation__scale-h" style="margin-bottom: var(--space-3)">Technology</p>
              <ul class="slide-stack__chips chips">${chips}</ul>
            </div>
            <div class="slide-stack__engagement">
              <dl>
                <div>
                  <dt>Engagement</dt>
                  <dd>${c.engagement.duration}</dd>
                </div>
                <div>
                  <dt>Operating cost</dt>
                  <dd>${c.engagement.tco}</dd>
                </div>
                <div>
                  <dt>Outcome</dt>
                  <dd>${c.engagement.summary}</dd>
                </div>
              </dl>
            </div>
            <div class="slide-stack__cta">
              <h3 class="slide-stack__cta-h">Want this for your team?</h3>
              <button type="button" class="btn btn-primary" id="slide-cta-book">Book a discovery call</button>
            </div>
          </div>
        </article>
      `;
    }

    function bind() {
      // Close handlers
      root.querySelectorAll('[data-close]').forEach((el) =>
        el.addEventListener('click', close)
      );

      // Nav buttons
      prevBtn.addEventListener('click', prevSlide);
      nextBtn.addEventListener('click', nextSlide);

      // Stage click — handle slide-5 CTA via delegation
      stage.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'slide-cta-book') {
          close();
          // After close, scroll to booking
          setTimeout(() => {
            const target = document.getElementById('contact');
            if (target) target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
          }, prefersReducedMotion ? 0 : 320);
        }
      });

      // Keyboard
      document.addEventListener('keydown', (e) => {
        if (!isOpen) return;
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            close();
            break;
          case 'ArrowRight':
            e.preventDefault();
            nextSlide();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            prevSlide();
            break;
          case ']':
            e.preventDefault();
            nextCase();
            break;
          case '[':
            e.preventDefault();
            prevCase();
            break;
          case 'Tab':
            trapFocus(e);
            break;
        }
      });

      // Swipe (touch)
      let touchStartX = null;
      stage.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) touchStartX = e.touches[0].clientX;
      }, { passive: true });
      stage.addEventListener('touchend', (e) => {
        if (touchStartX === null) return;
        const endX = (e.changedTouches[0] || {}).clientX || 0;
        const delta = endX - touchStartX;
        if (Math.abs(delta) > 50) {
          if (delta < 0) nextSlide();
          else prevSlide();
        }
        touchStartX = null;
      });
    }

    function trapFocus(e) {
      const focusables = root.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const visible = Array.from(focusables).filter(
        (el) => el.offsetParent !== null && !el.disabled
      );
      if (visible.length === 0) return;
      const first = visible[0];
      const last = visible[visible.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    return { open, close, bind };
  })();

  /* ---------------------------------------------------------------------
     Approach strip — auto-cycles while in viewport; pauses on hover so
     the user's pointer drives the active state directly.
     --------------------------------------------------------------------- */
  function bootApproachStrip() {
    const strip = document.getElementById('approach-strip');
    if (!strip) return;
    const stations = strip.querySelectorAll('.approach__station');
    if (stations.length === 0) return;

    // Make stations focusable for keyboard users — they get the same
    // hover-style treatment via :focus-within.
    stations.forEach((s, idx) => {
      s.setAttribute('tabindex', '0');
      s.setAttribute('role', 'group');
      s.setAttribute('aria-label', `Step ${idx + 1}: ${s.querySelector('.approach__h').textContent.trim()}`);
    });

    if (prefersReducedMotion) return;

    let i = 0;
    let cycleTimer = null;
    let isVisible = false;
    let isPaused = false;

    function tick() {
      if (isPaused) return;
      stations.forEach((s) => s.classList.remove('is-active'));
      stations[i].classList.add('is-active');
      i = (i + 1) % stations.length;
    }

    function start() {
      if (cycleTimer) return;
      tick();
      cycleTimer = setInterval(tick, 3000);
    }
    function stop() {
      if (cycleTimer) {
        clearInterval(cycleTimer);
        cycleTimer = null;
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (isVisible) start();
          else stop();
        });
      },
      { threshold: 0.3 }
    );
    io.observe(strip);

    // Pause cycling while the user is hovering the strip
    strip.addEventListener('mouseenter', () => { isPaused = true; });
    strip.addEventListener('mouseleave', () => { isPaused = false; });
    strip.addEventListener('focusin', () => { isPaused = true; });
    strip.addEventListener('focusout', (e) => {
      // Only un-pause if focus is leaving the whole strip
      if (!strip.contains(e.relatedTarget)) isPaused = false;
    });
  }

  /* ---------------------------------------------------------------------
     Calendly — lazy-on-intent inline embed.
     The third-party script does not load until the booking section
     intersects the viewport (or the user activates the placeholder).
     --------------------------------------------------------------------- */
  const CALENDLY_URL = 'https://calendly.com/avoegio22/30min';

  function bootCalendly() {
    const placeholder = document.getElementById('calendly-placeholder');
    if (!placeholder) return;

    let loaded = false;

    function load() {
      if (loaded) return;
      loaded = true;
      placeholder.classList.add('is-loaded');
      placeholder.removeAttribute('role');
      placeholder.removeAttribute('tabindex');

      placeholder.innerHTML = '';
      const widget = document.createElement('div');
      widget.className = 'calendly-inline-widget';

      // Theme overrides via Calendly URL params: cream bg, warm graphite text, terracotta accent
      const params = new URLSearchParams({
        hide_gdpr_banner: '1',
        background_color: 'f9f3eb',
        text_color: '2a221a',
        primary_color: 'c87651',
      });
      widget.setAttribute('data-url', `${CALENDLY_URL}?${params.toString()}`);
      widget.style.minWidth = '320px';
      widget.style.height = '780px';
      placeholder.appendChild(widget);

      // Inject Calendly's external script once
      if (!document.querySelector('script[data-calendly]')) {
        const s = document.createElement('script');
        s.src = 'https://assets.calendly.com/assets/external/widget.js';
        s.async = true;
        s.setAttribute('data-calendly', '1');
        document.head.appendChild(s);
      }
    }

    placeholder.addEventListener('click', load);
    placeholder.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        load();
      }
    });

    // Lazy-on-intent: load when booking section enters viewport
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            load();
            io.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(placeholder);
  }

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  function init() {
    bootHeroReveal();
    bootHeader();
    renderBento();
    Lightbox.bind();
    bootApproachStrip();
    bootCalendly();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
