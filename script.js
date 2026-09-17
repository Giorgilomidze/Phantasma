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
        image: { src: './images/case1-built.webp', alt: 'E-commerce cost engine' },
      thumbnail: { src: './images/Slider Thumbnail 1 - automatic invoiceing.webp', alt: 'E-commerce cost engine' },
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
      fullText: [
        { h: 'Executive Summary', p: 'Developed an end-to-end data automation ecosystem for a multi-channel e-commerce firm managing 8,000+ SKUs and 20+ manufacturers. The project transformed a manual, error-prone accounting process involving complex contract pricing and marketplace commissions into a scalable, $60/month cloud-native solution.' },
        { h: 'The Challenge', p: 'The company faced a massive operational bottleneck. Variable pricing across 20 manufacturers, multi-channel marketplace commission complexity, logistical fragmentation with diverse shipping costs, and a resource drain of 80 man-hours (3 highly skilled staff over 5 days) to calculate COGS and generate invoices.' },
        { h: 'Technical Solution', p: 'Architected a robust ETL/ELT pipeline using Azure and Power Platform. Built a custom API retrieval platform pulling from multiple e-commerce marketplaces, implemented a multi-format Data Lake handling JSON, CSV, and Parquet, and developed a parallel validation bridge ensuring 100% data integrity. Engineered a star schema database with fact tables for transactional data and dimension tables mapping SKUs to contract terms. Created a Power App for logistics teams to update delivery rates, and configured a Google Sheets-to-Azure pipeline for business users to update contract terms without touching code. Developed Paginated Reports that automatically calculated net margins and generated client-ready invoices.' },
        { h: 'Business Impact', p: 'Total labor time reduced from 80 hours to 5 hours — 93.7% reduction. Turnaround time cut from 5 days to 2 days. Operational cost moved from 3 senior FTEs to a $60 cloud fee plus 5 QA hours. Scalability shifted from linear to exponential with zero bottleneck. 75 hours of high-level employee time reclaimed per cycle.' },
        { h: 'Technology Stack', p: 'Azure Data Factory, Azure Data Lake Storage Gen2, MSSQL SQL Data Warehouse, Power BI Paginated Reports, Power Apps, Google Sheets API, Amazon SP-API, Shopify API.' },
      ],
    },

    {
      slug: 'mining-operational-intelligence',
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
        image: { src: './images/case2-built.webp', alt: 'Industrial scale-up & operational intelligence' },
      thumbnail: { src: './images/Slider Thumbnail 2 - Mining.webp', alt: 'Industrial scale-up & operational intelligence' },
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
      fullText: [
        { h: 'Executive Summary', p: 'A rapidly expanding mining and raw materials producer faced severe operational bottlenecks following a series of acquisitions. Disconnected data silos — spreadsheets, local drives, and manual accounting — hindered management of the full mining lifecycle from land acquisition to ecological restoration. We designed an integrated data ecosystem that automated document processing, unified task management with financial flows, and provided C-level executives with real-time decision-making snapshots.' },
        { h: 'The Challenge', p: 'Rapid acquisition of new companies led to non-standardized processes across different mining sites. Critical information was trapped in local computers, manual invoices, and isolated accounting software. The lifecycle involved high-stakes legal documentation, land rights, mining operations, and green-coverage regeneration. Massive human effort was required to map cash flows to specific tasks and process physical invoices.' },
        { h: 'Technical Solution', p: 'Used Azure Data Factory and Databricks to ingest data from the Accounting API and ClickUp API. Implemented Azure Machine Learning OCR to digitize manual invoices, extract metadata, and automatically map them to project tasks. Centralized all operations in ClickUp, ensuring every task was linked to its respective financial cash flow. Developed Power Apps for structured data entry and used SharePoint as a governed document library. Implemented Row-Level Security and Active Directory integration to ensure departments only accessed relevant data.' },
        { h: 'Business Impact', p: 'Monthly task capacity grew from 40 to 280 tasks — 700% increase. Raw material processing increased from 3,500 to 11,000 units — 314% increase. Labor inefficiency reduced 40%. Data accessibility expanded from under 10% siloed to 80% organization-wide. Total cost of ownership €15,000 over two years covering all cloud services and IT support.' },
        { h: 'Technology Stack', p: 'Azure Databricks, Azure Data Factory, Azure Machine Learning (OCR), Power BI, Power Apps, SharePoint, ClickUp API, Azure Active Directory, Row-Level Security.' },
      ],
    },

    {
      slug: 'monolith-recovery',
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
        image: { src: './images/case3-built.webp', alt: 'Monolith to microservices recovery' },
      thumbnail: { src: './images/Slider Thumbnail 6 - Failed project transformation.webp', alt: 'Monolith to microservices recovery' },
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
      fullText: [
        { h: 'Executive Summary', p: 'Engaged to perform a forensic audit of a failing e-commerce ecosystem operating across Amazon and Shopify. The client had previously attempted to centralize operations into a single PHP-based monolith. We performed a complete architectural overhaul, replacing the monolith with a modern decoupled microservices cloud architecture.' },
        { h: 'The Challenge', p: 'Every function — ETL processes, API authentications, database procedures, and front-end reporting — existed within one massive codebase. A minor change in one module caused unforeseen regressions elsewhere, leading to debugging marathons lasting weeks. The system was so complex only the original author could navigate it. Reports were hard-coded in Python, requiring senior developers just to change a simple KPI. Single-threaded ETL meant data synchronization lagged as sales volume grew.' },
        { h: 'Technical Solution', p: 'Azure Data Factory replaced hard-coded PHP scripts with visual monitoring of data pipelines, automated retries, and scheduled daily ingestion from Amazon and Shopify APIs. Azure Databricks enabled Spark for massive data processing. Azure SQL centralized all fragmented data into a Single Source of Truth. Power BI empowered non-technical stakeholders to build their own dashboards. Azure DevOps implemented CI/CD pipelines separating Development, Staging, and Production. Data Lake Storage ADLS Gen2 created a Bronze layer storing raw JSON for historical reprocessing. Terraform and Bicep ensured Infrastructure as Code. Azure AD with RBAC secured department-level data access.' },
        { h: 'Business Impact', p: 'Replaced a fragile monolith with a resilient microservices architecture. Operating cost dropped to standard Azure-native run rates. Non-technical stakeholders gained self-service BI. Zero single-point-of-failure in the new architecture. Full CI/CD lifecycle with separated environments.' },
        { h: 'Technology Stack', p: 'Azure Data Factory, Azure Databricks (Spark), Azure SQL Data Warehouse, ADLS Gen2, Power BI, Azure DevOps (CI/CD), Terraform, Bicep, Azure Active Directory (RBAC), ClickUp, Amazon SP-API, Shopify API.' },
      ],
    },

    {
      slug: 'precision-viticulture',
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
        image: { src: './images/case4-built.webp', alt: 'Precision viticulture IoT' },
      thumbnail: { src: './images/Slider Thumbnail 5 - IOT.webp', alt: 'Precision viticulture IoT' },
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
      fullText: [
        { h: 'Executive Summary', p: 'Designed and deployed a complete precision agriculture system for a 12-hectare vineyard, combining IoT sensor infrastructure, edge computing, cloud data pipelines, and predictive automation to create a fully autonomous, weather-aware irrigation system.' },
        { h: 'Research & Agronomic Strategy', p: 'Conducted extensive research to define the Optimal Growth Window, establishing specific thresholds for nutrient and soil chemistry including ideal NPK fertilizer ratios, environmental variables covering optimal sunlight exposure and air humidity, the precise moisture level between drought stress and over-saturation to maximize sugar content, and soil pH balance assessments.' },
        { h: 'Infrastructure & IoT Deployment', p: 'Designed hydraulic planning for a system pumping water from a low-altitude river up a mountain slope into storage reservoirs. Specified high-pressure pumps, NPK mixers, water storage tanks, and kilometers of hose droppers for gravity-fed irrigation. Deployed IoT devices in calculated locations to monitor soil NPK, moisture, and temperature in real-time. Built a low-power always-on physical server on-site as a data retrieval center ensuring connectivity in a remote area.' },
        { h: 'Cloud Architecture & Automation', p: 'Built scalable pipelines using Azure and Databricks to sync on-site sensor data with external Weather Forecast APIs. Developed a decision-support model forecasting water needs based on upcoming weather patterns through evapotranspiration versus predicted rainfall. The system automatically controlled the pumping station, keeping the vineyard at optimal moisture while minimizing energy consumption. Result: 12 hectares of autonomous, weather-aware irrigation requiring no manual intervention.' },
        { h: 'Technology Stack', p: 'IoT soil sensors (NPK, moisture, temperature), on-premise edge computing server, Azure cloud pipelines, Azure Databricks, Weather Forecast API integration, automated pump control systems.' },
      ],
    },

    {
      slug: 'pharmacy-digitalisation',
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
        image: { src: './images/case5-built.webp', alt: 'Pharmacy chain digital transformation' },
      thumbnail: { src: './images/Slider Thumbnail 4 - pharmacy.webp', alt: 'Pharmacy chain digital transformation' },
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
      fullText: [
        { h: 'Executive Summary', p: 'Led the end-to-end modernization of a 6-store pharmacy chain\'s infrastructure to align with evolving Georgian healthcare regulations. The project involved a complex migration of 20 years of legacy data, implementation of an AI-driven product mapping library, and deployment of a centralized IoT monitoring system to ensure Good Distribution Practice (GDP) compliance.' },
        { h: 'The Challenge', p: 'The primary hurdle was extracting and normalizing two decades of fragmented data from a 20-year-old legacy ERP system. Product naming, logistical info, and categorization varied wildly across different sources. To meet strict new regulations, 100% accuracy was required in how medicines were identified and tracked across the supply chain.' },
        { h: 'Technical Solution', p: 'Implemented a Central Product Library pulling data from the Ministry of Healthcare, Revenue Service, logistical databases, and historical purchase invoices, using AI tools to parse and match medicinal names across disparate sources. Built a custom Data Warehouse with sales prediction models and an automated procurement system generating purchase orders per branch based on real-time sales velocity. Deployed a centralized IoT network monitoring temperature and humidity across all 6 locations for GDP-compliant pharmaceutical storage. Deployed Google Workspace for all SOPs and regulatory documents, and HubSpot for sales, marketing, and purchasing operations.' },
        { h: 'Business Impact', p: 'Achieved total regulatory compliance. Unified 6 stores and 20 years of data into a single GDP-compliant infrastructure. Reduced procurement waste through automated demand forecasting. Established a scalable foundation for future growth. Centralized and automated all mandatory Ministry of Healthcare reporting workflows.' },
        { h: 'Technology Stack', p: 'Custom Data Warehouse, IoT temperature and humidity sensors, AI-powered product mapping, ERP integration, Google Workspace, HubSpot, Ministry of Healthcare API reporting.' },
      ],
    },

    {
      slug: 'demand-forecasting',
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
        image: { src: './images/case6-built.webp', alt: 'Demand forecasting engine' },
      thumbnail: { src: './images/Slider Thumbnail 3 - Warehouse forecasting.webp', alt: 'Demand forecasting engine' },
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
      fullText: [
        { h: 'Executive Summary', p: 'Developed an end-to-end data pipeline and machine learning solution for a large-scale e-commerce distributor managing 12,000 SKUs across 200 brands. The project automated the unification of fragmented sales channels and inventory data, replacing manual procurement processes with a predictive model that achieved 98% forecasting accuracy, significantly outperforming traditional human-led purchasing at 81%.' },
        { h: 'The Challenge', p: 'Data was fragmented across multiple e-commerce platforms and 40 different manufacturers. Managing 12,000 products with varying logistical requirements including PZN, EAN, and GTIN codes, packaging types, and expiration dates created extreme complexity. Sales were highly sensitive to seasonality, delivery restrictions, and external market trends. Manual stock maintenance led to frequent overstocking causing capital tie-up or understocking causing lost revenue.' },
        { h: 'Technical Solution', p: 'Orchestrated Azure Data Factory pipelines to ingest data via APIs and Databricks from disparate sales channels. Stored and structured raw data into an MSSQL Data Warehouse. Unified sales data from multiple channels into a single Golden Record table. Modeled sales data based on rolling windows of 7, 30, and 90 days, year-over-year comparisons, and category-level trends. Integrated external API data to capture broader market trends and seasonal shifts. Implemented an Azure Machine Learning model generating automated replenishment suggestions. Conducted rigorous backtesting comparing forecasts against historical inventory levels and actual sales performance.' },
        { h: 'Business Impact', p: 'Model precision reached 98% after cleaning data externalities. Significantly outperformed human procurement specialists who averaged 81% accuracy. Automated generation of invoices and stock listings, reducing manual labor and human error in the supply chain. Eliminated overstocking and understocking cycles across 12,000 SKUs.' },
        { h: 'Technology Stack', p: 'Azure Data Factory, Azure Databricks, MSSQL Data Warehouse, Azure Machine Learning, SQL, Python, Shopify API, Amazon SP-API, External Market Trend APIs.' },
      ],
    },

    {
      slug: 'water-utility-predictive-ops',
      industry: 'Water & Utilities',
      title: 'Predictive Infrastructure for Urban Water Utility',
      outcome: 'From reactive break-fix to data-driven, predictive operations for a city of 3M+ residents.',
      kpiNum: '+100%',
      kpiLabel: 'daily incident throughput',
      heroMetric: { kind: 'numeric', value: '+100%', label: 'daily incident throughput', foil: '40–55 → 80–140 per day, 82 field teams' },
      situation: {
        prose:
          'A century-old water utility serving 3M+ residents ran entirely on reactive break-fix. SAP ERP was used as a basic task list, IoT pressure and level data sat unused, and field, warehouse, and fleet teams operated in silos with no shared KPIs. The incentive structure rewarded slow work — finishing a job quickly just meant being assigned the next difficult one.',
        scale: [
          { num: '3M+', label: 'residents served' },
          { num: '82', label: 'field teams' },
          { num: '4.5 hrs', label: 'avg fix time' },
          { num: '<10%', label: 'IoT data utilised' },
        ],
      },
      built: {
        rows: [
          [
            { label: 'SAP ERP + IoT telemetry (pressure & level)' },
            { arrow: true },
            { label: 'PostgreSQL Data Warehouse' },
            { arrow: true },
            { label: 'Python ML Forecasting' },
          ],
          [
            { label: 'Asset inventory + billing consumption map' },
            { arrow: true },
            { label: 'KPI & alert layer' },
            { arrow: true },
            { label: 'SAP via REST API + Power BI' },
          ],
        ],
        caption:
          'Unified a century of fragmented operational data into a single warehouse. ML forecasting achieved 80% daily / 90% weekly / 93% monthly confidence. Alerts and work orders pushed back into SAP so field teams never had to leave the system they already used.',
        image: { src: './images/case7-built.webp', alt: 'Predictive infrastructure for urban water utility' },
      thumbnail: { src: './images/Slider Thumbnail 7 - Water incident managment.webp', alt: 'Predictive infrastructure for urban water utility' },
      },
      impact: {
        type: 'table',
        headers: ['Before', 'After'],
        rows: [
          ['Incidents resolved / day', '40–55', '80–140'],
          ['Average fix time', '4.5 hrs', '3.0 hrs (−33%)'],
          ['High-severity pipe bursts (YoY)', 'Baseline', '−12%'],
          ['Active field teams (of 82)', '~25', '30 (+20% capacity)'],
        ],
      },
      stack: ['SAP ERP', 'PostgreSQL', 'Python ML', 'Power BI', 'IoT (pressure & level sensors)', 'Custom REST APIs'],
      engagement: { duration: '~6 months', tco: 'Discovery, design, build, and 6-month support', summary: 'Turned a reactive century-old operation into a predictive, data-driven enterprise — without replacing SAP.' },
      fullText: [
        { h: 'Executive Summary', p: 'A century-old water utility serving a city of more than three million people was running its operations reactively. The SAP ERP incident management module was used as a basic task list, field teams worked without shared performance signals, and IoT data already collected was sitting unused. We redesigned the operational process end-to-end, built a unified data warehouse, deployed a machine-learning forecasting layer, and integrated predictive alerts back into SAP. Daily incident throughput more than doubled, average fix time dropped by 33%, and high-severity pipe bursts fell by 12% year-over-year.' },
        { h: 'Root Causes Identified', p: 'A meaningful portion of the underground network was undocumented or wrongly mapped in SAP, causing field teams to discover wrong pipe specs on-site requiring second trips. Field crews, warehouse staff, and fleet maintenance operated in silos with no shared KPIs — finishing a job quickly was effectively punished. Without forecasting, every road closure request to City Hall arrived as a last-minute emergency. A significant share of pipe failures traced to over-pressure conditions and water hammer effects on sloped heritage infrastructure sections.' },
        { h: 'Technical Solution', p: 'Built a centralized PostgreSQL data warehouse consolidating SAP incident records, live IoT telemetry from pressure gauges and reservoir levels, the asset inventory, and billing-derived consumption map. Surfaced correlations between incidents and air temperature, sediment quantity, geographic zone and elevation, pipe age and material cohort, and in-pipe pressure profiles. Built a machine learning forecasting service achieving 80% daily, 90% weekly, and 93% monthly confidence. Connected forecast-driven alerts back into SAP via custom REST API, generating work orders inside the system operators already used. Power BI dashboards covered incident volume against forecasts, fix-time distribution, team utilization, and warehouse readiness.' },
        { h: 'Business Impact', p: 'Daily incidents resolved increased from 40–55 to 80–140 — a 100–150% improvement. Average fix time reduced from 4.5 hours to 3.0 hours — 33% faster. High-severity pipe bursts fell 12% year-over-year in a controlled comparable period. Activated operational teams increased from approximately 25 to 30 out of 82 total teams. The utility moved from being treated as a problematic neighbor to a data-driven partner in urban management, with improved permit speed and political capital with City Hall.' },
        { h: 'Technology Stack', p: 'SAP ERP (Incident Management), PostgreSQL data warehouse, Python ML forecasting, Power BI, IoT pressure and level telemetry, custom REST APIs, Azure cloud infrastructure.' },
      ],
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
     Mobile nav — hamburger toggle for the <=767px header.
     The nav itself is the same <nav id="site-nav"> used on desktop; CSS
     turns it into a drop-down panel and .is-open on the header shows it.
     --------------------------------------------------------------------- */
  function bootNavToggle() {
    const header = document.getElementById('site-header');
    const toggle = header && header.querySelector('.nav-toggle');
    const nav = document.getElementById('site-nav');
    if (!header || !toggle || !nav) return;

    function setOpen(open) {
      header.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open
        ? (toggle.dataset.labelClose || 'Close menu')
        : (toggle.dataset.labelOpen || 'Open menu'));
    }
    function isOpen() {
      return header.classList.contains('is-open');
    }

    toggle.addEventListener('click', () => {
      const open = !isOpen();
      setOpen(open);
      if (open) {
        const first = nav.querySelector('a');
        if (first) first.focus();
      }
    });

    // Esc closes and hands focus back to the button
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Choosing a link closes the panel (in-page anchors don't reload)
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });

    // Tap outside the header closes it
    document.addEventListener('click', (e) => {
      if (isOpen() && !header.contains(e.target)) setOpen(false);
    });

    // Leaving the mobile breakpoint resets state so desktop nav is clean
    const mq = window.matchMedia('(max-width: 1023px)');
    mq.addEventListener('change', (ev) => {
      if (!ev.matches) setOpen(false);
    });
  }

  /* ---------------------------------------------------------------------
     Case Reel — horizontal infinite auto-scrolling carousel
     --------------------------------------------------------------------- */
  function bootCaseReel() {
    const track = document.getElementById('case-reel-track');
    const dotsEl = document.getElementById('case-reel-dots');
    const prevBtn = document.querySelector('.case-reel__arrow--prev');
    const nextBtn = document.querySelector('.case-reel__arrow--next');
    if (!track) return;

    const VISIBLE = 4;
    const total = CASES.length;
    let pos = total; // start at first real slide (after leading clones)
    let isAnimating = false;
    let autoTimer;

    // Build: [clones of last VISIBLE] + [real slides] + [clones of first VISIBLE]
    const allSlides = [...CASES, ...CASES, ...CASES]; // triple for safety
    allSlides.forEach((c, i) => {
      const slide = document.createElement('div');
      slide.className = 'case-reel__slide';
      slide.innerHTML = `
        <button type="button" class="case-reel__card" aria-label="Open case study: ${c.title}">
          <img class="case-reel__img" src="${c.built.thumbnail.src}" alt="${c.built.thumbnail.alt}" loading="lazy" />
          <div class="case-reel__overlay">
            <span class="case-reel__title">${c.title}</span>
          </div>
        </button>`;
      slide.querySelector('.case-reel__card').addEventListener('click', () => {
        Lightbox.open(c.slug);
      });
      track.appendChild(slide);
    });

    // Dots (one per real case)
    CASES.forEach((c, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'case-reel__dot';
      dot.setAttribute('aria-label', `Go to ${c.title}`);
      dot.addEventListener('click', () => goTo(i + total));
      dotsEl.appendChild(dot);
    });

    function slideWidth() {
      const slide = track.querySelector('.case-reel__slide');
      return slide ? slide.offsetWidth : 0;
    }

    function render(instant) {
      const x = -(pos * slideWidth());
      track.style.transition = instant ? 'none' : 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)';
      track.style.transform = `translateX(${x}px)`;
      // Update dots against real index
      const realIndex = ((pos - total) % total + total) % total;
      dotsEl.querySelectorAll('.case-reel__dot').forEach((d, i) => {
        d.classList.toggle('is-active', i === realIndex);
      });
    }

    function goTo(newPos) {
      if (isAnimating) return;
      pos = newPos;
      isAnimating = true;
      render(false);
    }

    function advance(dir) {
      goTo(pos + dir);
    }

    // After transition: jump to real equivalent if in clone zone
    track.addEventListener('transitionend', () => {
      isAnimating = false;
      if (pos >= total * 2) { pos -= total; render(true); }
      if (pos < total)      { pos += total; render(true); }
    });

    prevBtn.addEventListener('click', () => { resetAuto(); advance(-1); });
    nextBtn.addEventListener('click', () => { resetAuto(); advance(1); });

    function startAuto() {
      autoTimer = setInterval(() => advance(1), 5000);
    }
    function resetAuto() {
      clearInterval(autoTimer);
      startAuto();
    }

    // Pause on hover
    const viewport = document.querySelector('.case-reel__viewport');
    if (viewport) {
      viewport.addEventListener('mouseenter', () => clearInterval(autoTimer));
      viewport.addEventListener('mouseleave', startAuto);
    }

    render(true);
    startAuto();
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

    const SLIDE_LABELS = ['Cover', 'The Situation', 'What we built', 'Impact', 'Stack & Engagement', 'Full Case Study'];

    function open(slug) {
      if (isAnimating || isOpen) return;
      const idx = CASES.findIndex((c) => c.slug === slug);
      if (idx === -1) return;
      caseIndex = idx;
      slideIndex = 0;
      isOpen = true;
      lastFocused = document.activeElement;

      const tile = document.querySelector(`[data-case-slug="${slug}"]`);

      // Render content first so we can measure
      render();

      // Show lightbox
      root.hidden = false;
      document.body.classList.add('is-locked');

      if (!tile || prefersReducedMotion) {
        root.classList.add('is-open');
        finishOpen();
        return;
      }

      // Compute FLIP transform: lightbox -> tile rect on initial frame
      const tileRect = tile.getBoundingClientRect();
      requestAnimationFrame(() => {
        const targetRect = container.getBoundingClientRect();
        const sx = tileRect.width / targetRect.width;
        const sy = tileRect.height / targetRect.height;
        const tx = (tileRect.left + tileRect.width / 2) - (targetRect.left + targetRect.width / 2);
        const ty = (tileRect.top + tileRect.height / 2) - (targetRect.top + targetRect.height / 2);

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
      if (slideIndex < 5) {
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
      slideIndex = Math.max(0, Math.min(5, i));
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
        `<strong>${String(slideIndex + 1).padStart(2, '0')}</strong> / 06`;

      // Slide content
      stage.innerHTML = renderSlide(c, slideIndex);
      stage.querySelector('.slide').classList.add('is-active');

      // Dots
      dotsEl.innerHTML = '';
      for (let i = 0; i < 6; i++) {
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
      nextBtn.disabled = slideIndex === 5;

      // Announce
      if (announceCase) {
        announce.textContent = `Now viewing case ${caseIndex + 1} of ${CASES.length}: ${c.title}`;
      } else {
        announce.textContent = `Slide ${slideIndex + 1} of 6: ${SLIDE_LABELS[slideIndex]}`;
      }
    }

    function renderSlide(c, idx) {
      switch (idx) {
        case 0: return slideCover(c);
        case 1: return slideSituation(c);
        case 2: return slideBuilt(c);
        case 3: return slideImpact(c);
        case 4: return slideStack(c);
        case 5: return slideFullCase(c);
      }
      return '';
    }

    function slideFullCase(c) {
      if (!c.fullText) return `<article class="slide"><span class="slide__chip">${c.industry}</span><h2 class="slide__h">Full Case Study</h2><p>No extended content available.</p></article>`;
      const sections = c.fullText.map(s => `
        <div class="slide-full__section">
          <h3 class="slide-full__h">${s.h}</h3>
          <p class="slide-full__p">${s.p}</p>
        </div>`).join('');
      return `
        <article class="slide slide--full">
          <span class="slide__chip">${c.industry}</span>
          <h2 class="slide__h">Full Case Study</h2>
          <div class="slide-full__body">${sections}</div>
        </article>`;
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
      const coverImageHTML = c.built && c.built.image
        ? `<button class="slide-built__image-btn slide-cover__image-btn" aria-label="View full image" data-src="${c.built.image.src}" data-alt="${c.built.image.alt}">
             <img class="slide-built__image" src="${c.built.image.src}" alt="${c.built.image.alt}" />
             <span class="slide-built__image-hint">Click to enlarge</span>
           </button>`
        : '';
      return `
        <article class="slide slide--cover-with-image" id="slide-active">
          <span class="slide__chip">${c.industry}</span>
          <div class="slide-cover__main">
            <div class="slide-cover__text">
              <h2 class="slide__h" id="lightbox-title">${c.title}</h2>
              <p class="slide__lead">${c.outcome}</p>
              ${heroBlock}
            </div>
            ${coverImageHTML}
          </div>
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
          <div class="slide-built__body">
            <div>
              <div class="slide-built__diagram">${rows}</div>
              <p class="slide-built__caption">${c.built.caption}</p>
            </div>
          </div>
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
      if (!root) return;
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
     KPI funnel (projects page) — reads data/kpis.json at load and renders
     the `funnel` array as stacked bands. Stage count, order and labels
     come from the file; nothing here is hardcoded. Band width is
     log-scaled so a 0 still shows as a 28% band.
     --------------------------------------------------------------------- */
  function bootKpiFunnel() {
    const root = document.getElementById('kpi-funnel');
    const lede = document.getElementById('kpi-funnel-lede');
    if (!root || !lede) return;

    // Copy lives on the page so the Georgian version can supply its own
    const locale = document.documentElement.lang || 'en-GB';
    const ledeText = lede.dataset.text || 'Every number is live and comes straight from our working data.';
    const updatedText = lede.dataset.updated || 'Updated {date}.';

    function unavailable() {
      lede.textContent = lede.dataset.unavailable || 'Live figures unavailable';
      root.innerHTML = '';
    }

    // Browsers ship no Georgian date names, so those are spelled out here
    const KA_MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
      'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];

    function formatDate(iso) {
      const d = new Date(iso + 'T00:00:00');
      if (isNaN(d)) return iso;
      if (locale.startsWith('ka')) {
        return d.getDate() + ' ' + KA_MONTHS[d.getMonth()] + ', ' + d.getFullYear();
      }
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function render(data) {
      const stages = Array.isArray(data.funnel)
        ? data.funnel.filter((s) => s && typeof s.label === 'string' && Number.isFinite(Number(s.value)))
        : [];
      if (!stages.length) { unavailable(); return; }

      lede.textContent = ledeText
        + (data.as_of ? ' ' + updatedText.replace('{date}', formatDate(String(data.as_of))) : '');

      const max = Math.max(...stages.map((s) => Number(s.value)), 0);
      const denom = Math.log10(max + 1) || 1;
      const last = stages.length - 1;

      root.innerHTML = '';
      stages.forEach((s, i) => {
        const value = Number(s.value);
        const width = 28 + 72 * (Math.log10(value + 1) / denom);
        const mix = last ? (i / last) * 100 : 100;
        const band = document.createElement('div');
        band.className = 'kpi-band' + (mix >= 60 ? ' kpi-band--dark' : '');
        band.style.setProperty('--w', width.toFixed(2) + '%');
        band.style.setProperty('--mix', mix.toFixed(0) + '%');
        band.setAttribute('role', 'group');
        band.setAttribute('aria-label', s.label + ': ' + value.toLocaleString('en-GB'));
        band.innerHTML =
          '<span class="kpi-band__label"></span>' +
          '<span class="kpi-band__value"></span>';
        band.firstChild.textContent = s.label;
        band.lastChild.textContent = value.toLocaleString('en-GB');
        root.appendChild(band);
      });

      // Grow-in on first scroll into view, unless the user asked for less motion
      if (prefersReducedMotion || !('IntersectionObserver' in window)) return;
      root.classList.add('js-animate');
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          root.classList.add('is-in');
          io.disconnect();
        }
      }, { threshold: 0.2 });
      io.observe(root);
    }

    fetch(root.dataset.src, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(render)
      .catch(unavailable);
  }

  /* ---------------------------------------------------------------------
     Calendly — lazy-on-intent inline embed.
     The third-party script does not load until the booking section
     intersects the viewport (or the user activates the placeholder).
     --------------------------------------------------------------------- */

  // ---------------------------------------------------------------------------
  // Auth + client accounts (Supabase)
  //
  // supabase-js is loaded from CDN on the pages that need it (index, blog,
  // projects, projects.ka, account) *before* script.js. Pages without it
  // (landing) simply skip everything here. The publishable key is safe in
  // the browser: every table has RLS, so it can only do what the policies in
  // supabase/schema.sql allow.
  // ---------------------------------------------------------------------------
  const SUPABASE_URL = 'https://muumpjtpjnoxxdkhqtik.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_R6Ruxp1ehYAGVcFRqrM_Lg_n1ahoV8e';

  // Keepz fixed-amount payment links, one per plan code. The same three URLs
  // are hard-coded on projects.html / projects.ka.html — keep all in step.
  // They expire 31-12-2026 (see CLAUDE.md §6).
  const KEEPZ_BASE = 'https://app.keepz.me/pay?qrType=CUSTOM&receiverType=USER&receiverId=26e203ca-01f0-444b-bab3-ac4d5631b91e&productId=';
  const KEEPZ_LINKS = {
    detective: KEEPZ_BASE + '150bec12-356c-4f0f-b4b7-243574577d35',
    essential: KEEPZ_BASE + 'f51bd2a4-5ac6-4673-bd5e-d7f85bc7149f',
    advanced:  KEEPZ_BASE + '04216b80-e048-4f1a-83a0-d45e89920e49',
  };

  const Auth = (() => {
    let client = null;
    let session = null;

    function getClient() {
      if (client) return client;
      if (!window.supabase || !window.supabase.createClient) return null;
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      return client;
    }

    // Where a magic link / OAuth round-trip should land: back on this page.
    // Every such URL must be allow-listed in Supabase → Auth → URL Configuration.
    function returnUrl() {
      return location.origin + location.pathname;
    }

    function signIn(email, password) {
      return getClient().auth.signInWithPassword({ email, password });
    }

    function signUp(email, password) {
      return getClient().auth.signUp({ email, password, options: { emailRedirectTo: returnUrl() } });
    }

    // Reset email lands on account.html, which shows the "set a new password"
    // form when the PASSWORD_RECOVERY event fires.
    function resetPassword(email) {
      return getClient().auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/account.html' });
    }

    function updatePassword(password) {
      return getClient().auth.updateUser({ password });
    }

    function loadProfile() {
      return getClient().from('profiles')
        .select('first_name, middle_name, last_name, full_name, linkedin_url, cv_path, cv_uploaded_at')
        .eq('id', session.user.id).maybeSingle();
    }

    // CV: upload the new file first, then delete the old one, then point the
    // profile at the new path — so a failed upload never loses the old CV.
    async function uploadCv(file, oldPath) {
      const sb = getClient();
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
      const path = session.user.id + '/cv-' + Date.now() + '.' + ext;
      const up = await sb.storage.from('cvs').upload(path, file, { contentType: file.type || undefined });
      if (up.error) return { error: up.error };
      const upd = await sb.from('profiles').update({ cv_path: path, cv_uploaded_at: new Date().toISOString() }).eq('id', session.user.id);
      if (upd.error) return { error: upd.error };
      if (oldPath) await sb.storage.from('cvs').remove([oldPath]);
      return { path };
    }

    async function removeCv(path) {
      const sb = getClient();
      if (path) await sb.storage.from('cvs').remove([path]);
      return sb.from('profiles').update({ cv_path: null, cv_uploaded_at: null }).eq('id', session.user.id);
    }

    // Private bucket → short-lived signed URL for preview / download.
    function cvUrl(path) {
      return getClient().storage.from('cvs').createSignedUrl(path, 600);
    }

    function saveProfile(fields) {
      const full = [fields.first_name, fields.middle_name, fields.last_name].filter(Boolean).join(' ');
      return getClient().from('profiles').update(Object.assign({}, fields, { full_name: full || null })).eq('id', session.user.id);
    }

    function loadPreferences() {
      return getClient().from('preferences').select('salary_min, salary_max, currency, answers').eq('user_id', session.user.id).maybeSingle();
    }

    // Upsert the whole row; `answers` is merged client-side before calling.
    function savePreferences(row) {
      return getClient().from('preferences').upsert(Object.assign({ user_id: session.user.id }, row), { onConflict: 'user_id' });
    }

    // Server-side: records the request, emails the owner, deletes the login.
    function deleteAccount() {
      return getClient().rpc('request_account_deletion');
    }

    function signInWithGoogle() {
      return getClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnUrl() } });
    }

    function signOut() {
      return getClient().auth.signOut();
    }

    // ---- data access. Every call is RLS-limited to the signed-in user; see
    // supabase/README.md for the table/column contract.

    // Pay now: open a pending subscription request for this account. The
    // owner confirms it against the Keepz dashboard and sets it active.
    function requestSubscription(planCode) {
      if (!session) return Promise.resolve({ error: new Error('not signed in') });
      return getClient().from('subscriptions')
        .insert({ account_id: session.user.id, plan_code: planCode, status: 'pending' });
    }

    // The account page: get_my_stats() (one row, or none while no candidates
    // row is linked yet), every shortlist row with its vacancy, and sends.
    function loadStats() {
      const sb = getClient();
      return Promise.all([
        sb.rpc('get_my_stats'),
        sb.from('shortlists')
          .select('id, week, rank, start_processing, client_decision, why_matches, salary_text, ' +
                  'vacancies ( id, title, company_raw, location, source, url, deadline_at, description, companies ( name ) )')
          .order('week', { ascending: false }).order('rank'),
        sb.from('sends')
          .select('vacancy_id, sent_at, outcome, outcome_at, vacancies ( title, company_raw, url, companies ( name ) )')
          .order('sent_at', { ascending: false }),
      ]).then(([stats, shortlists, sends]) => ({
        stats: (stats.data && stats.data[0]) || null,
        shortlists: shortlists.data || [],
        sends: sends.data || [],
        weeks: new Set((shortlists.data || []).map((r) => r.week)).size,
        errors: [stats.error, shortlists.error, sends.error].filter(Boolean),
      }));
    }

    // Sync every .js-auth link (header button, mobile nav item) to the
    // current session. Labels live on the element so the Georgian page can
    // supply its own.
    function paintLinks() {
      const signedIn = !!session;
      document.querySelectorAll('.js-auth').forEach((el) => {
        el.textContent = signedIn ? el.dataset.labelAccount : el.dataset.labelLogin;
        el.dataset.state = signedIn ? 'in' : 'out';
      });
      document.dispatchEvent(new CustomEvent('phantasma:auth', { detail: { session, event: lastEvent } }));
    }

    let lastEvent = null;

    function boot() {
      const sb = getClient();
      if (!sb) return;
      sb.auth.onAuthStateChange((event, s) => {
        session = s;
        lastEvent = event;
        paintLinks();
      });
      sb.auth.getSession().then(({ data }) => {
        session = data.session;
        paintLinks();
      });
    }

    return {
      boot,
      getSession: () => session,
      signIn,
      signUp,
      resetPassword,
      updatePassword,
      deleteAccount,
      loadProfile,
      saveProfile,
      uploadCv,
      removeCv,
      cvUrl,
      loadPreferences,
      savePreferences,
      signInWithGoogle,
      signOut,
      requestSubscription,
      loadStats,
    };
  })();

  // Login modal (#auth-modal): Google, or email + password with three modes
  // (login / signup / forgot) on one form. Same open/close conventions as
  // the lightbox: Esc closes, backdrop closes, focus restored.
  function bootAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal || !window.supabase) return;

    const form     = modal.querySelector('#auth-form');
    const title    = modal.querySelector('#auth-title');
    const email    = modal.querySelector('#auth-email');
    const password = modal.querySelector('#auth-password');
    const pwRow    = modal.querySelector('#auth-pw-row');
    const pwHint   = modal.querySelector('#auth-pw-hint');
    const submit   = modal.querySelector('#auth-submit');
    const switcher = modal.querySelector('#auth-switch');
    const forgot   = modal.querySelector('#auth-forgot');
    const google   = modal.querySelector('#auth-google');
    const status   = modal.querySelector('#auth-status');
    const closeEls = modal.querySelectorAll('[data-close]');
    let lastFocus = null;

    function say(kind, text) {
      status.textContent = text;
      status.dataset.kind = kind;
      status.hidden = !text;
    }

    function setMode(mode) {
      form.dataset.mode = mode;
      title.textContent    = title.dataset['title' + cap(mode)];
      submit.textContent   = submit.dataset['label' + cap(mode)];
      switcher.textContent = switcher.dataset['label' + cap(mode)];
      pwRow.hidden   = mode === 'forgot';
      password.required = mode !== 'forgot';
      password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
      pwHint.hidden  = mode !== 'signup';
      forgot.hidden  = mode !== 'login';
      say('', '');
    }
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    function open(mode) {
      lastFocus = document.activeElement;
      setMode(mode || 'login');
      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add('is-open'));
      document.body.classList.add('is-locked');
      email.focus();
    }

    function close() {
      modal.classList.remove('is-open');
      modal.hidden = true;
      document.body.classList.remove('is-locked');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    closeEls.forEach((el) => el.addEventListener('click', close));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
    switcher.addEventListener('click', () => setMode(form.dataset.mode === 'login' ? 'signup' : 'login'));
    forgot.addEventListener('click', () => setMode('forgot'));

    // Map Supabase's error messages to the page's own copy.
    function explain(error) {
      const m = (error && error.message || '').toLowerCase();
      if (m.includes('invalid login credentials')) return form.dataset.msgBadLogin;
      if (m.includes('already registered') || m.includes('already exists')) return form.dataset.msgExists;
      if (m.includes('password') && (m.includes('short') || m.includes('at least'))) return form.dataset.msgWeak;
      if (m.includes('not confirmed')) return form.dataset.msgUnconfirmed;
      if (m.includes('rate limit')) return form.dataset.msgRateLimit;
      return form.dataset.msgError;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mode = form.dataset.mode;
      const mail = email.value.trim();
      const pw = password.value;
      if (!mail) { email.focus(); return; }
      if (mode !== 'forgot' && pw.length < 8) { say('error', form.dataset.msgWeak); password.focus(); return; }
      say('busy', form.dataset.msgSending);

      if (mode === 'login') {
        const { error } = await Auth.signIn(mail, pw);
        if (error) say('error', explain(error));   // success closes via phantasma:auth
      } else if (mode === 'signup') {
        const { data, error } = await Auth.signUp(mail, pw);
        if (error) { say('error', explain(error)); return; }
        // Supabase returns a user with no identities when the email already exists.
        if (data.user && data.user.identities && data.user.identities.length === 0) { say('error', form.dataset.msgExists); return; }
        if (data.session) return;                  // confirmations off → signed in already
        say('ok', form.dataset.msgSignupSent.replace('{email}', mail));
      } else {
        const { error } = await Auth.resetPassword(mail);
        if (error) { say('error', explain(error)); return; }
        say('ok', form.dataset.msgForgotSent.replace('{email}', mail));
      }
    });

    google.addEventListener('click', async () => {
      say('busy', form.dataset.msgSending);
      const { error } = await Auth.signInWithGoogle();
      if (error) say('error', form.dataset.msgError);
    });

    // Header / nav auth links: signed out → open modal; signed in → follow
    // the href to account.html.
    document.querySelectorAll('.js-auth').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (Auth.getSession()) return;
        e.preventDefault();
        open('login');
      });
    });

    // Pay now buttons: require sign-in, log a pending subscription, then open Keepz.
    document.querySelectorAll('[data-tier]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (!Auth.getSession()) {
          e.preventDefault();
          open('signup');
          return;
        }
        // The browser opens the Keepz tab (user gesture); record in parallel.
        Auth.requestSubscription(btn.dataset.tier).then(({ error }) => {
          if (error) console.warn('subscription request not recorded', error.message);
        });
      });
    });

    // After an actual sign-in (modal login, or arriving back from Google /
    // a confirmation link with tokens in the URL) go straight to the profile.
    // Not on plain page loads with an existing session, and not when already
    // on a profile page.
    const arrivedWithTokens = /access_token=|[?&]code=/.test(location.hash + location.search);
    document.addEventListener('phantasma:auth', (e) => {
      if (!e.detail.session) return;
      const onProfile = /\/(account|preferences)\.html$/.test(location.pathname);
      const fresh = e.detail.event === 'SIGNED_IN' && (!modal.hidden || arrivedWithTokens);
      if (!modal.hidden) close();
      if (fresh && !onProfile) location.replace('./account.html');
    });
  }

  // account.html — the client's numbers as tiles; each tile opens one panel
  // below the grid with the rows behind it (one panel open at a time).
  // Values arrive from get_my_stats(); tiles reveal with a stagger and count
  // up like the hero strip (triggerCountUp reads data-count-to). No
  // candidates row yet → zeros plus "Your first shortlist is being prepared".
  function bootAccountPage() {
    const root = document.getElementById('account');
    if (!root || !window.supabase) return;

    const out   = root.querySelector('#account-signed-out');
    const inn   = root.querySelector('#account-signed-in');
    const grid  = root.querySelector('#stat-grid');
    const panel = root.querySelector('#stat-panel');
    const pTitle = root.querySelector('#stat-panel-title');
    const pBody  = root.querySelector('#stat-panel-body');
    const SERVICE_WEEKS = 4;
    let data = null;
    let openKey = null;

    const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
    const company = (v) => (v && ((v.companies && v.companies.name) || v.company_raw)) || '—';
    const short = (t, n) => (t ? (t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t) : '');
    const SOURCE = { 'jobs.ge': 'jobs.ge', 'hr.ge': 'hr.ge', tbc: 'TBC Bank', bog: 'Bank of Georgia' };
    const OUTCOME = { sent: 'Sent', applied: 'Applied', interview: 'Interview', offer: 'Offer', rejected: 'Rejected', no_reply: 'No reply' };

    // ---- table builders (text via textContent; only hrefs come from data)
    function table(headers, rows, cells) {
      if (!rows.length) {
        const p = document.createElement('p');
        p.className = 'account__empty';
        p.textContent = 'Nothing here yet.';
        return p;
      }
      const t = document.createElement('table');
      t.className = 'account-table';
      const thead = t.createTHead().insertRow();
      headers.forEach((h) => { const th = document.createElement('th'); th.textContent = h; thead.appendChild(th); });
      const tb = t.createTBody();
      rows.forEach((r) => {
        const tr = tb.insertRow();
        cells(r).forEach((c) => {
          const td = tr.insertCell();
          if (c && c.href) {
            const a = document.createElement('a');
            a.href = c.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
            a.textContent = c.text;
            td.appendChild(a);
            if (c.sub) { const s = document.createElement('span'); s.className = 't-sub'; s.textContent = c.sub; td.appendChild(s); }
          } else {
            td.textContent = c == null ? '—' : c;
          }
        });
      });
      return t;
    }

    function vacancyRows(rows) {
      return table(
        ['Week', '#', 'Company', 'Position', 'Why it matches', 'Source', 'Deadline'],
        rows,
        (r) => {
          const v = r.vacancies || {};
          return [
            fmtDate(r.week), r.rank,
            company(v),
            { href: v.url, text: v.title || '—', sub: [v.location, r.salary_text].filter(Boolean).join(' · ') },
            r.why_matches || short(v.description, 140),
            SOURCE[v.source] || v.source,
            fmtDate(v.deadline_at),
          ];
        });
    }

    function sendRows(rows) {
      return table(
        ['Company', 'Position', 'Sent', 'Outcome', 'Updated'],
        rows,
        (r) => {
          const v = r.vacancies || {};
          return [company(v), { href: v.url, text: v.title || '—' }, fmtDate(r.sent_at), OUTCOME[r.outcome] || r.outcome, fmtDate(r.outcome_at)];
        });
    }

    const PANELS = {
      weeks: {
        title: 'Weekly runs',
        build: (d) => {
          const byWeek = {};
          d.shortlists.forEach((r) => { byWeek[r.week] = (byWeek[r.week] || 0) + 1; });
          const rows = Object.keys(byWeek).sort().reverse().map((w, i, arr) => ({ n: arr.length - i, week: w, count: byWeek[w] }));
          return table(['Run', 'Date', 'Vacancies shortlisted'], rows, (r) => [r.n + ' of ' + SERVICE_WEEKS, fmtDate(r.week), r.count]);
        },
      },
      processed:  { title: 'Vacancies processed', build: (d) => vacancyRows(d.shortlists) },
      companies:  {
        title: 'Companies reviewed',
        build: (d) => {
          const by = {};
          d.shortlists.forEach((r) => { const c = company(r.vacancies); by[c] = (by[c] || 0) + 1; });
          const rows = Object.keys(by).sort((a, b) => by[b] - by[a]).map((c) => ({ c, n: by[c] }));
          return table(['Company', 'Vacancies shortlisted'], rows, (r) => [r.c, r.n]);
        },
      },
      selected:   { title: 'Selected for you', build: (d) => vacancyRows(d.shortlists.filter((r) => r.start_processing)) },
      sent:       { title: 'Applications sent', build: (d) => sendRows(d.sends) },
      interviews: { title: 'Interviews', build: (d) => sendRows(d.sends.filter((r) => r.outcome === 'interview')) },
      offers:     { title: 'Offers', build: (d) => sendRows(d.sends.filter((r) => r.outcome === 'offer')) },
    };

    function openPanel(key) {
      if (!data) return;
      if (openKey === key) { closePanel(); return; }
      openKey = key;
      grid.querySelectorAll('[data-panel]').forEach((b) => b.setAttribute('aria-expanded', String(b.dataset.panel === key)));
      pTitle.textContent = PANELS[key].title;
      pBody.innerHTML = '';
      pBody.appendChild(PANELS[key].build(data));
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('is-open'));
    }

    function closePanel() {
      openKey = null;
      grid.querySelectorAll('[data-panel]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      panel.classList.remove('is-open');
      panel.hidden = true;
    }

    function renderStats(d) {
      const st = d.stats;
      const nums = {
        weeks:      Math.min(d.weeks, SERVICE_WEEKS),
        processed:  st ? st.vacancies_processed : 0,
        companies:  st ? st.companies_processed : 0,
        selected:   st ? st.vacancies_selected  : 0,
        sent:       st ? st.applications_sent   : 0,
        interviews: st ? st.interviews          : 0,
        offers:     st ? st.offers              : 0,
      };
      Object.keys(nums).forEach((k) => {
        const el = root.querySelector('[data-stat="' + k + '"]');
        el.textContent = nums[k];
        el.dataset.countTo = String(nums[k]);
      });
      root.querySelector('[data-stat="lastweek"]').textContent =
        st && st.last_shortlist_week ? fmtDate(st.last_shortlist_week) : '—';
      root.querySelector('#account-stats-note').hidden = !!(st && st.vacancies_processed > 0);

      grid.classList.remove('is-in');
      if (prefersReducedMotion) { grid.classList.add('is-in'); return; }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        grid.classList.add('is-in');
        triggerCountUp();
      }));
    }

    async function render(session) {
      out.hidden = !!session;
      inn.hidden = !session;
      closePanel();
      if (!session) return;
      root.querySelector('#account-email').textContent = session.user.email;
      Auth.loadProfile().then(({ data: p }) => {
        profile = p || {}; paintProfile();
        cvPath = (p && p.cv_path) || null; paintCv();
      });
      data = await Auth.loadStats();
      if (data.errors.length) console.warn('account: query failed', data.errors.map((e) => e.message));
      renderStats(data);
    }

    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-panel]');
      if (b) openPanel(b.dataset.panel);
    });
    root.querySelector('#stat-panel-close').addEventListener('click', closePanel);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openKey) closePanel(); });

    // Password form: "Change password" toggles it; a reset-email landing
    // (PASSWORD_RECOVERY) opens it with the recovery title.
    const newpass  = root.querySelector('#account-newpass');
    const npTitle  = root.querySelector('#newpass-title');
    const npToggle = root.querySelector('#account-changepass');
    function showNewpass(kind) {
      npTitle.textContent = npTitle.dataset['title' + kind.charAt(0).toUpperCase() + kind.slice(1)];
      newpass.hidden = false;
      npToggle.setAttribute('aria-expanded', 'true');
      newpass.querySelector('input').focus();
    }
    function hideNewpass() {
      newpass.hidden = true;
      npToggle.setAttribute('aria-expanded', 'false');
    }
    npToggle.addEventListener('click', () => (newpass.hidden ? showNewpass('change') : hideNewpass()));
    document.addEventListener('phantasma:auth', (e) => {
      if (e.detail.event === 'PASSWORD_RECOVERY') showNewpass('recovery');
    });

    // ---- small modal controller (same conventions as the login modal)
    function modalCtl(el) {
      let lastFocus = null;
      function open(focusSel) {
        lastFocus = document.activeElement;
        el.hidden = false;
        requestAnimationFrame(() => el.classList.add('is-open'));
        document.body.classList.add('is-locked');
        const f = focusSel && el.querySelector(focusSel);
        if (f) f.focus();
      }
      function close() {
        el.classList.remove('is-open');
        el.hidden = true;
        document.body.classList.remove('is-locked');
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }
      el.querySelectorAll('[data-close]').forEach((c) => c.addEventListener('click', close));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) close(); });
      return { open, close, get isOpen() { return !el.hidden; } };
    }

    // ---- profile details modal (names + LinkedIn)
    let profile = {};
    const pfModal = modalCtl(document.getElementById('profile-modal'));
    const pfForm  = document.getElementById('profile-form');
    const pfNote  = document.getElementById('profile-status');
    const liSlug  = root.querySelector('#linkedin-slug');
    const liEdit  = root.querySelector('#linkedin-edit');
    const nameEl  = root.querySelector('#account-name');
    const slugOf  = (u) => { const m = /linkedin\.com\/in\/([^/?#]+)/i.exec(u || ''); return m ? m[1] : ''; };
    const pfSay   = (kind, text) => { pfNote.textContent = text; pfNote.dataset.kind = kind; pfNote.hidden = !text; };

    function paintProfile() {
      const sl = slugOf(profile.linkedin_url);
      liSlug.textContent = sl ? 'linkedin.com/in/' + sl : liSlug.dataset.empty;
      liSlug.classList.toggle('is-empty', !sl);
      liEdit.textContent = sl ? liEdit.dataset.labelEdit : liEdit.dataset.labelAdd;
      liEdit.classList.toggle('is-add', !sl);
      const full = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ');
      nameEl.textContent = full;
      nameEl.hidden = !full;
    }
    function openProfile() {
      ['first_name', 'middle_name', 'last_name', 'linkedin_url'].forEach((k) => { pfForm[k].value = profile[k] || ''; });
      pfSay('', '');
      pfModal.open('#pf-first');
    }
    root.querySelector('#account-profile-btn').addEventListener('click', openProfile);
    liEdit.addEventListener('click', openProfile);
    pfForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = {
        first_name:   pfForm.first_name.value.trim() || null,
        middle_name:  pfForm.middle_name.value.trim() || null,
        last_name:    pfForm.last_name.value.trim() || null,
        linkedin_url: pfForm.linkedin_url.value.trim() || null,
      };
      if (fields.linkedin_url && !slugOf(fields.linkedin_url)) { pfSay('error', pfForm.dataset.msgBad); pfForm.linkedin_url.focus(); return; }
      pfSay('busy', pfForm.dataset.msgSaving);
      const { error } = await Auth.saveProfile(fields);
      if (error) { pfSay('error', pfForm.dataset.msgError); return; }
      Object.assign(profile, fields);
      paintProfile();
      pfSay('ok', pfForm.dataset.msgSaved);
      setTimeout(() => { if (pfModal.isOpen) pfModal.close(); }, 700);
    });

    // ---- CV modal (PDF only, ≤ 5 MB)
    const cvModalEl = document.getElementById('cv-modal');
    const cvModal = modalCtl(cvModalEl);
    const cvBtn   = root.querySelector('#account-cv-btn');
    const cvFile  = root.querySelector('#account-cv-file');
    const cvName  = document.getElementById('account-cv-name');
    const cvDl    = document.getElementById('account-cv-download');
    const cvPrev  = document.getElementById('account-cv-preview');
    const cvNote  = document.getElementById('account-cv-status');
    const MAX_CV  = 5 * 1024 * 1024;
    let cvPath = null;
    const cvSay = (kind, text) => { cvNote.textContent = text; cvNote.dataset.kind = kind; cvNote.hidden = !text; };

    function paintCv() {
      cvBtn.textContent = cvPath ? cvBtn.dataset.labelReview : cvBtn.dataset.labelUpload;
    }
    async function showCv() {
      cvSay('', '');
      cvPrev.hidden = true;
      cvPrev.removeAttribute('src');
      cvName.textContent = cvPath.split('/').pop().replace(/^cv-\d+\./, 'cv.');
      if (!cvModal.isOpen) cvModal.open();
      const { data, error } = await Auth.cvUrl(cvPath);
      if (error || !data) { cvSay('error', cvModalEl.dataset.msgError); return; }
      cvDl.href = data.signedUrl;
      cvPrev.src = data.signedUrl + '#toolbar=0';
      cvPrev.hidden = false;
    }
    cvBtn.addEventListener('click', () => { if (cvPath) showCv(); else cvFile.click(); });
    document.getElementById('account-cv-replace').addEventListener('click', () => cvFile.click());
    cvFile.addEventListener('change', async () => {
      const file = cvFile.files[0];
      cvFile.value = '';
      if (!file) return;
      const bad = (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) ? 'msgType'
                : file.size > MAX_CV ? 'msgSize' : null;
      if (bad) {
        if (!cvModal.isOpen) { cvName.textContent = ''; cvPrev.hidden = true; cvModal.open(); }
        cvSay('error', cvModalEl.dataset[bad]);
        return;
      }
      if (!cvModal.isOpen) { cvName.textContent = file.name; cvPrev.hidden = true; cvModal.open(); }
      cvSay('busy', cvModalEl.dataset.msgUploading);
      const { path, error } = await Auth.uploadCv(file, cvPath);
      if (error) { cvSay('error', cvModalEl.dataset.msgError); return; }
      cvPath = path;
      paintCv();
      await showCv();
      cvSay('ok', cvModalEl.dataset.msgUploaded);
    });
    document.getElementById('account-cv-remove').addEventListener('click', async () => {
      if (!window.confirm(cvModalEl.dataset.confirmRemove)) return;
      const { error } = await Auth.removeCv(cvPath);
      if (error) { cvSay('error', cvModalEl.dataset.msgError); return; }
      cvPath = null;
      paintCv();
      cvModal.close();
    });

    // Delete my account
    const del = root.querySelector('#account-delete');
    del.addEventListener('click', async () => {
      if (!window.confirm(del.dataset.confirm)) return;
      const st = root.querySelector('#delete-status');
      st.textContent = del.dataset.msgBusy; st.dataset.kind = 'busy'; st.hidden = false;
      del.disabled = true;
      const { error } = await Auth.deleteAccount();
      if (error) {
        st.textContent = del.dataset.msgError; st.dataset.kind = 'error';
        del.disabled = false;
        return;
      }
      try { await Auth.signOut(); } catch (_) { /* user is already gone */ }
      root.querySelector('#account-deleted').hidden = false;
      render(null);
    });
    newpass.addEventListener('submit', async (e) => {
      e.preventDefault();
      const st = root.querySelector('#newpass-status');
      const pw = newpass.password.value;
      const note = (kind, text) => { st.textContent = text; st.dataset.kind = kind; st.hidden = !text; };
      if (pw.length < 8) { note('error', newpass.dataset.msgWeak); return; }
      note('busy', newpass.dataset.msgSaving);
      const { error } = await Auth.updatePassword(pw);
      note(error ? 'error' : 'ok', error ? newpass.dataset.msgError : newpass.dataset.msgSaved);
      if (!error) setTimeout(hideNewpass, 2500);
    });

    root.querySelector('#account-signout').addEventListener('click', async () => {
      await Auth.signOut();
      render(null);
    });

    document.addEventListener('phantasma:auth', (e) => render(e.detail.session));
  }

  // preferences.html — the questionnaire. Groups collapse/expand; each has
  // its own Save. Counters = answered / total per group and overall.
  function bootPreferencesPage() {
    const root = document.getElementById('preferences');
    if (!root || !window.supabase) return;

    const out = root.querySelector('#account-signed-out');
    const inn = root.querySelector('#account-signed-in');
    const total = root.querySelector('#pref-total');
    const groups = Array.from(root.querySelectorAll('.pref-group'));
    let saved = { salary_min: null, salary_max: null, currency: 'GEL', answers: {} };
    let dirty = false;

    const filled = (el) => el.type === 'radio' ? false : String(el.value || '').trim() !== '';

    // A question counts as answered when its control has a value. The salary
    // question counts once if either number is filled.
    function countGroup(g) {
      const qs = Array.from(g.querySelectorAll('.pref-q'));
      const n = qs.filter((q) => Array.from(q.querySelectorAll('[data-q]')).some(filled)).length;
      g.querySelector('[data-count]').textContent = n + ' / ' + qs.length;
      g.classList.toggle('is-complete', n === qs.length);
      return [n, qs.length];
    }
    function countAll() {
      let n = 0, m = 0;
      groups.forEach((g) => { const [a, b] = countGroup(g); n += a; m += b; });
      total.textContent = n + ' / ' + m + ' answered';
    }

    function fill() {
      groups.forEach((g) => {
        const f = g.querySelector('form');
        Array.from(f.elements).forEach((el) => {
          if (!el.name) return;
          if (el.name === 'currency') el.checked = el.value === saved.currency;
          else if (el.name === 'salary_min' || el.name === 'salary_max') el.value = saved[el.name] == null ? '' : saved[el.name];
          else if (el.hasAttribute('data-q')) el.value = saved.answers[el.name] || '';
        });
      });
      countAll();
    }

    groups.forEach((g) => {
      const btn = g.querySelector('.pref-group__toggle');
      const body = g.querySelector('.pref-group__body');
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        body.hidden = open;
      });
      body.addEventListener('input', () => { dirty = true; countGroup(g); });
      body.addEventListener('submit', async (e) => {
        e.preventDefault();
        const st = body.querySelector('.account-form__status');
        const note = (kind, text) => { st.textContent = text; st.dataset.kind = kind; st.hidden = !text; };
        const row = { answers: Object.assign({}, saved.answers) };
        Array.from(body.elements).forEach((el) => {
          if (!el.name) return;
          if (el.name === 'currency') { if (el.checked) row.currency = el.value; }
          else if (el.name === 'salary_min' || el.name === 'salary_max') row[el.name] = el.value === '' ? null : Number(el.value);
          else if (el.hasAttribute('data-q')) row.answers[el.name] = el.value.trim();
        });
        if (row.salary_min != null && row.salary_max != null && row.salary_min > row.salary_max) { note('error', body.dataset.msgSalary); return; }
        note('busy', body.dataset.msgSaving);
        const { error } = await Auth.savePreferences(row);
        if (error) { note('error', body.dataset.msgError); return; }
        saved = Object.assign({}, saved, row);
        dirty = false;
        note('ok', body.dataset.msgSaved);
        countAll();
      });
    });

    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    async function render(session) {
      out.hidden = !!session;
      inn.hidden = !session;
      if (!session) return;
      const { data } = await Auth.loadPreferences();
      if (data) saved = { salary_min: data.salary_min, salary_max: data.salary_max, currency: data.currency || 'GEL', answers: data.answers || {} };
      fill();
    }
    document.addEventListener('phantasma:auth', (e) => render(e.detail.session));
  }

  const CALENDLY_URL = 'https://calendly.com/lomiddze/30min';

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
      widget.style.height = '680px';
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
     Image zoom overlay
     --------------------------------------------------------------------- */
  function bootImageZoom() {
    const overlay = document.createElement('div');
    overlay.className = 'img-zoom-overlay';
    overlay.innerHTML = `
      <button class="img-zoom-overlay__close" aria-label="Close full image">×</button>
      <img class="img-zoom-overlay__img" src="" alt="" />
    `;
    document.body.appendChild(overlay);

    const overlayImg = overlay.querySelector('.img-zoom-overlay__img');

    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.slide-built__image-btn');
      if (btn) {
        overlayImg.src = btn.dataset.src;
        overlayImg.alt = btn.dataset.alt;
        overlay.classList.add('is-open');
        overlay.focus();
        return;
      }
      if (overlay.classList.contains('is-open') &&
          (e.target === overlay || e.target.closest('.img-zoom-overlay__close'))) {
        overlay.classList.remove('is-open');
      }
    });

    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') overlay.classList.remove('is-open');
    });
  }

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  function bootCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (!banner) return;
    if (localStorage.getItem('phantasma_cookie_consent')) return;

    banner.hidden = false;

    document.getElementById('cookie-accept').addEventListener('click', () => {
      localStorage.setItem('phantasma_cookie_consent', 'accepted');
      banner.hidden = true;
      if (typeof gtag === 'function') {
        gtag('consent', 'update', {
          analytics_storage: 'granted',
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted'
        });
        gtag('event', 'conversion', {
          send_to: 'AW-18182297582/4NM8CKTh37EcEO6v_91D',
          value: 1.0,
          currency: 'USD'
        });
      }
    });

    document.getElementById('cookie-decline').addEventListener('click', () => {
      localStorage.setItem('phantasma_cookie_consent', 'declined');
      banner.hidden = true;
    });
  }

  function init() {
    bootHeroReveal();
    bootHeader();
    bootNavToggle();
    bootCookieBanner();
    bootCaseReel();
    Lightbox.bind();
    bootApproachStrip();
    bootKpiFunnel();
    Auth.boot();
    bootAuthModal();
    bootAccountPage();
    bootPreferencesPage();
    bootCalendly();
    bootImageZoom();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
