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
        { h: 'Business Impact', p: 'Monthly task capacity grew from 40 to 280 tasks — 7× as many (+600%). Raw material processing increased from 3,500 to 11,000 units — +214% (3.1×). Labor inefficiency reduced 40%. Data accessibility expanded from under 10% siloed to 80% organization-wide. Total cost of ownership €15,000 over two years covering all cloud services and IT support.' },
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
          <img class="case-reel__img" src="${c.built.thumbnail.src}" srcset="${encodeURI(c.built.thumbnail.src.replace(/\.webp$/, '-640.webp'))} 640w, ${encodeURI(c.built.thumbnail.src)} 1376w" sizes="(min-width: 768px) 1376px, 94vw" width="1376" height="768" alt="${c.built.thumbnail.alt}" loading="lazy" decoding="async" />
          <div class="case-reel__overlay">
            <span class="case-reel__title">${c.title}</span>
            <span class="case-reel__meta">
              <span class="case-reel__industry">${c.industry}</span>
              <span class="case-reel__kpi">${c.kpiNum}<span class="case-reel__kpi-label">${c.kpiLabel}</span></span>
            </span>
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

    // No autoplay under reduced motion or on touch devices (swipe / arrows instead)
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    function startAuto() {
      clearInterval(autoTimer);
      if (prefersReducedMotion || isTouch) return;
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

    // Touch: swipe left / right on the reel; stop auto-advance while a finger is down.
    if (viewport) {
      let touchX = null;
      let touchY = null;
      viewport.addEventListener('touchstart', (e) => {
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
        clearInterval(autoTimer);
      }, { passive: true });
      viewport.addEventListener('touchend', (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        const dy = e.changedTouches[0].clientY - touchY;
        touchX = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) advance(dx < 0 ? 1 : -1);
        startAuto();
      }, { passive: true });
    }

    // Re-measure on resize / rotation so the single phone card stays aligned
    window.addEventListener('resize', () => render(true));

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
     KPI funnel (projects page) — reads the `public_kpis` view in Supabase
     (one row of counts, see supabase/0010-public-kpis.sql) and renders
     stacked bands. Stage order and labels come from `data-stages` on the
     page so the Georgian version can supply its own; the view supplies the
     numbers. If Supabase is unreachable it falls back to data/kpis.json
     (data-src). Band width is log-scaled so a 0 still shows as a 28% band.
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

    // Page-supplied stages: [{key, label}]; values are looked up by key
    let stageDefs = [];
    try { stageDefs = JSON.parse(root.dataset.stages || '[]'); } catch (e) { stageDefs = []; }

    function render(data) {
      const stages = stageDefs
        .map((d) => ({ label: d.label, value: data[d.key] }))
        .filter((s) => typeof s.label === 'string' && Number.isFinite(Number(s.value)));
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

    // Live numbers from the view; the JSON file only if that fails
    function fromFile() {
      return fetch(root.dataset.src, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
    }
    function fromView() {
      if (!window.supabase) return Promise.reject(new Error('no supabase'));
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
        .from('public_kpis').select('*').single()
        .then(({ data, error }) => (error || !data ? Promise.reject(error) : data));
    }
    fromView().catch(fromFile).then(render).catch(unavailable);
  }

  // Plan cards on the projects pages (5 Nov 2026): each card starts collapsed
  // to its header button (tier, name, price, chevron); a click opens or closes
  // that card only. The open state lives in aria-expanded + .is-open (the CSS
  // animates the body; reduced motion is handled in section 21). startFlitt
  // also opens the card, so a payment message under Pay now is never hidden.
  function setPlanOpen(card, open) {
    const btn = card && card.querySelector('.pricing-card__toggle');
    if (!btn) return;
    btn.setAttribute('aria-expanded', String(open));
    card.classList.toggle('is-open', open);
  }

  function bootPricingCards() {
    document.querySelectorAll('.pricing-card').forEach((card) => {
      const btn = card.querySelector('.pricing-card__toggle');
      if (!btn) return;
      btn.addEventListener('click', () => setPlanOpen(card, btn.getAttribute('aria-expanded') !== 'true'));
    });
  }

  /* ---------------------------------------------------------------------
     Booking — Google appointment schedule, lazy iframe (see bootBooking).
     Nothing third-party loads until the visitor clicks to book.
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

    // Profile details, "What we read from your CV" (8 Nov 2026): the client's
    // own candidates row, written by the pipeline (RLS: account_id = auth.uid();
    // the filter keeps it one row should admins ever read more). No row yet = null.
    function loadCandidate() {
      return getClient().from('candidates')
        .select('headline, company_current, function, seniority, target_titles, locations, work_language, profile_url')
        .eq('account_id', session.user.id).maybeSingle();
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

    // Private buckets → short-lived signed URLs for preview / download.
    function cvUrl(path) {
      return getClient().storage.from('cvs').createSignedUrl(path, 600);
    }
    function workbookUrl(path) {
      return getClient().storage.from('shortlists').createSignedUrl(path, 600, { download: true });
    }

    function saveProfile(fields) {
      const full = [fields.first_name, fields.middle_name, fields.last_name].filter(Boolean).join(' ');
      return getClient().from('profiles').update(Object.assign({}, fields, { full_name: full || null })).eq('id', session.user.id);
    }

    function loadPreferences() {
      return getClient().from('preferences').select('salary_min, salary_max, currency, answers').eq('user_id', session.user.id).maybeSingle();
    }

    // Start matching (CAR-05, supabase/0030): the client's own requests,
    // newest first (admins may read everyone's, hence the user filter), and
    // the RPC that checks the rule again and queues one.
    function loadMatching() {
      return getClient().from('match_requests').select('id, status, created_at, started_at, finished_at')
        .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(10);
    }
    function requestMatching() {
      return getClient().rpc('request_matching');
    }

    // Upsert the whole row; `answers` is merged client-side before calling.
    function savePreferences(row) {
      return getClient().from('preferences').upsert(Object.assign({ user_id: session.user.id }, row), { onConflict: 'user_id' });
    }

    // Server-side: records the request, emails the owner, deletes the login.
    function deleteAccount() {
      return getClient().rpc('request_account_deletion');
    }

    // Google sign-in: Google's own button (see bootAuthModal) hands over a
    // signed ID token; Supabase checks it and signs the user in on this page.
    // Users are matched by their Google account id, so it is the same account
    // as with the old redirect login. `nonce` is the raw value whose SHA-256
    // went to Google.
    function signInWithGoogleToken(token, nonce) {
      return getClient().auth.signInWithIdToken({ provider: 'google', token, nonce });
    }

    // LinkedIn sign-in (OpenID Connect, 5 Nov 2026): a round trip through
    // LinkedIn's own login page and Supabase that lands back on this page
    // (returnUrl), where supabase-js picks the session up from the URL.
    // Supabase links logins that share the same verified email.
    function signInWithLinkedIn() {
      return getClient().auth.signInWithOAuth({ provider: 'linkedin_oidc', options: { redirectTo: returnUrl() } });
    }

    // Account page, LinkedIn status button (5 Nov 2026): add LinkedIn to the
    // signed-in account (round trip through LinkedIn, back to this page).
    // Needs "manual linking" switched on in Supabase; until then it returns an
    // error. Never fall back to signInWithOAuth: that could make a second account.
    function linkLinkedIn() {
      return getClient().auth.linkIdentity({ provider: 'linkedin_oidc', options: { redirectTo: location.href } });
    }

    function signOut() {
      return getClient().auth.signOut();
    }

    // ---- data access. Every call is RLS-limited to the signed-in user; see
    // supabase/README.md for the table/column contract.

    function db() { return getClient(); }

    // The account page: get_my_stats() (one row, or none while no candidates
    // row is linked yet), every shortlist row with its vacancy, and sends.
    // Vacancy + company columns for the account tables and their detail rows
    // (one embedded select, no extra queries). All readable under RLS for the
    // client's own shortlisted vacancies; any of them may be null.
    const VACANCY_DETAIL =
      'title, title_en, company_raw, location, function, seniority, salary_text, language, ' +
      'posted_at, deadline_at, description, source, url, ' +
      'companies ( name, name_ka, industry, description, website, linkedin_url, hq_city, size_band, founded_year, employees )';

    // Shortlist rows also carry score (match %, CAR-18; empty until the
    // pipeline fills it). Should that column ever be missing, the list
    // loads again without it rather than not at all.
    const SHORTLIST_COLS = 'id, week, rank, start_processing, client_decision, why_matches, salary_text, ' +
                           'vacancies ( id, ' + VACANCY_DETAIL + ' )';
    async function loadShortlists(sb) {
      const q = (cols) => sb.from('shortlists').select(cols).order('week', { ascending: false }).order('rank');
      const res = await q('score, ' + SHORTLIST_COLS);
      return res.error ? q(SHORTLIST_COLS) : res;
    }

    function loadStats() {
      const sb = getClient();
      return Promise.all([
        sb.rpc('get_my_stats'),
        sb.from('candidates').select('workbook_path, workbook_uploaded_at, linkedin_audit').maybeSingle(),
        loadShortlists(sb),
        sb.from('sends')
          .select('vacancy_id, sent_at, outcome, outcome_at, vacancies ( ' + VACANCY_DETAIL + ' )')
          .order('sent_at', { ascending: false }),
      ]).then(([stats, cand, shortlists, sends]) => ({
        stats: (stats.data && stats.data[0]) || null,
        workbook: (cand.data && cand.data.workbook_path) || null,
        audit: (cand.data && cand.data.linkedin_audit) || null,
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
      loadCandidate,
      saveProfile,
      uploadCv,
      removeCv,
      cvUrl,
      workbookUrl,
      loadPreferences,
      savePreferences,
      loadMatching,
      requestMatching,
      signInWithGoogleToken,
      signInWithLinkedIn,
      linkLinkedIn,
      signOut,
      loadStats,
      db,
    };
  })();

  // Shared focus trap for the modal dialogs (auth, pay, profile, CV, booking).
  // Call from a keydown handler while the dialog is open: Tab / Shift+Tab
  // cycle through the dialog's visible controls and never reach the page
  // behind it. (The Lightbox keeps its own trapFocus.)
  function trapTab(box, e) {
    if (e.key !== 'Tab' || !box) return;
    const items = Array.from(box.querySelectorAll(
      'a[href], button, input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])'
    )).filter((el) => !el.disabled && el.getClientRects().length > 0);
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0];
    const last  = items[items.length - 1];
    const here  = document.activeElement;
    const inside = box.contains(here);
    if (e.shiftKey && (here === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (here === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  // Google Identity Services ("Sign in with Google" button). Loaded only when
  // the login dialog first opens, so no Google sign-in script runs for
  // visitors who never log in. The client id is public (it is in every Google
  // sign-in URL); Google Cloud project phantasma-508619. Its Authorized
  // JavaScript origins must list https://solvephantasma.com and, for local
  // tests, http://localhost and http://localhost:8000.
  const GOOGLE_CLIENT_ID = '396544181713-ecijt1nf7u1qs4tej5n51vh7p4uu7m66.apps.googleusercontent.com';
  let gisLoading = null;
  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    if (!gisLoading) {
      gisLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = resolve;
        s.onerror = () => { s.remove(); gisLoading = null; reject(new Error('gis')); };
        document.head.appendChild(s);
      });
    }
    return gisLoading;
  }

  // Raw nonce for Supabase, its SHA-256 (hex) for Google: Supabase hashes the
  // raw value and compares it with the nonce inside Google's token.
  async function googleNonce() {
    const raw = btoa(String.fromCharCode.apply(null, crypto.getRandomValues(new Uint8Array(32))));
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const hashed = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
    return { raw, hashed };
  }

  // Login modal (#auth-modal): Google, or email + password with three modes
  // (login / signup / forgot) on one form. Same open/close conventions as
  // the lightbox: Esc closes, backdrop closes, Tab trapped, focus restored.
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
      if (mode === 'signup') track('signup_started');
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
      showGoogle().catch(() => {});   // #auth-google stays as the fallback
    }

    function close() {
      modal.classList.remove('is-open');
      modal.hidden = true;
      document.body.classList.remove('is-locked');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    // Closed by the visitor (✕, backdrop, Esc) = no sign-in: forget a Services
    // tile they had clicked, so a later login does not jump there.
    const SERVICE_KEY = 'phantasma_pending_service';
    function dismiss() {
      sessionStorage.removeItem(SERVICE_KEY);
      close();
    }

    closeEls.forEach((el) => el.addEventListener('click', dismiss));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) dismiss();
      else if (!modal.hidden) trapTab(modal, e);
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

    // Google: Google's own button replaces #auth-google once the GIS script
    // has loaded, so Google's window names solvephantasma.com instead of the
    // Supabase project address. Initialised and drawn once per page; it stays
    // in the dialog for later opens. If the script cannot load (blocked),
    // #auth-google stays: clicking it tries again, then explains.
    let gisShown = null;
    function showGoogle() {
      if (!gisShown) {
        gisShown = Promise.all([loadGis(), googleNonce()]).then(([, nonce]) => {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            nonce: nonce.hashed,
            callback: async (res) => {
              say('busy', form.dataset.msgSending);
              const { error } = await Auth.signInWithGoogleToken(res.credential, nonce.raw);
              if (error) say('error', form.dataset.msgError);   // success closes via phantasma:auth
            },
          });
          const slot = document.createElement('div');
          slot.className = 'auth-modal__gis';
          google.after(slot);
          window.google.accounts.id.renderButton(slot, {
            type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular',
            text: 'continue_with', logo_alignment: 'center',
            width: Math.max(200, Math.min(400, slot.offsetWidth || 320)),   // Google allows 200–400 px
            locale: document.documentElement.lang === 'ka' ? 'ka' : 'en',
          });
          google.hidden = true;
        }).catch((err) => { gisShown = null; throw err; });
      }
      return gisShown;
    }

    google.addEventListener('click', () => {
      say('busy', form.dataset.msgSending);
      showGoogle().then(() => say('', ''), () => say('error', form.dataset.msgError));
    });

    // LinkedIn: the browser goes to LinkedIn and comes back signed in.
    const linkedin = modal.querySelector('#auth-linkedin');
    if (linkedin) linkedin.addEventListener('click', async () => {
      say('busy', form.dataset.msgSending);
      const { error } = await Auth.signInWithLinkedIn();
      if (error) say('error', form.dataset.msgError);
    });

    // Header / nav auth links: signed out → open modal; signed in → follow
    // the href to the Services page (services.html / services.ka.html).
    document.querySelectorAll('.js-auth').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (Auth.getSession()) return;
        e.preventDefault();
        open('login');
      });
    });

    // Services tiles ([data-needs-login], services*.html): a service needs a
    // login. Signed in, the link goes straight through. Signed out, the login
    // dialog opens and the target waits in sessionStorage (like
    // phantasma_pending_tier, it survives the Google / LinkedIn round trip);
    // resumeService() sends the browser there right after the sign-in.
    document.querySelectorAll('[data-needs-login]').forEach((a) => {
      a.addEventListener('click', (e) => {
        if (Auth.getSession()) return;
        e.preventDefault();
        sessionStorage.setItem(SERVICE_KEY, a.getAttribute('href'));
        open('login');
      });
    });
    function resumeService() {
      const target = sessionStorage.getItem(SERVICE_KEY);
      if (!target) return false;
      sessionStorage.removeItem(SERVICE_KEY);
      if (!/^\.\/[\w./-]*$/.test(target)) return false;   // only our own relative links
      location.assign(target);                             // Back returns to Services
      return true;
    }

    // Pay now buttons. Signed in: flitt-create-order, then the browser goes to
    // Flitt's hosted checkout. Signed out: #pay-modal offers Log in / Create
    // account (payments are tied to an account); the chosen tier is remembered
    // (sessionStorage survives the Google round-trip) and the payment continues
    // right after sign-in.
    const payModal = document.getElementById('pay-modal');
    const PENDING_KEY = 'phantasma_pending_tier';
    const buttonFor = (tier) => document.querySelector('[data-tier="' + tier + '"]');

    function startFlitt(tier, btn) {
      const label = btn.textContent;
      setPlanOpen(btn.closest('.pricing-card'), true);   // resumePayment() runs without a click
      let note = btn.parentNode.querySelector('.pay-status');
      if (!note) {
        note = document.createElement('p');
        note.className = 'auth-modal__status pay-status';
        note.setAttribute('role', 'alert');
        btn.parentNode.appendChild(note);
      }
      note.hidden = true;
      btn.textContent = 'Starting secure payment…';
      btn.setAttribute('aria-disabled', 'true');
      btn.style.pointerEvents = 'none';
      const fail = (msg) => {
        btn.textContent = label;
        btn.removeAttribute('aria-disabled');
        btn.style.pointerEvents = '';
        note.dataset.kind = 'error';
        note.textContent = msg;
        note.hidden = false;
      };
      Auth.db().functions.invoke('flitt-create-order', { body: { tier } }).then(async ({ data, error }) => {
        if (error || !data || !data.checkout_url) {
          let msg = 'We could not start the payment. Please try again in a moment.';
          try {
            const body = error && error.context && await error.context.json();
            if (body && body.error && body.error.message) msg = body.error.message;
          } catch (_e) { /* keep the plain message */ }
          fail(msg);
          return;
        }
        if (!/^https:\/\//.test(data.checkout_url)) { fail('We could not start the payment. Please try again in a moment.'); return; }
        if (data.order_id) sessionStorage.setItem('phantasma_flitt_order', data.order_id);
        location.href = data.checkout_url;
      }).catch(() => fail('We could not reach the payment service. Check your connection and try again.'));
    }

    function resumePayment() {
      const tier = sessionStorage.getItem(PENDING_KEY);
      if (!tier) return false;
      sessionStorage.removeItem(PENDING_KEY);
      const btn = buttonFor(tier);
      if (!btn) return false;
      startFlitt(tier, btn);
      return true;
    }

    document.querySelectorAll('[data-tier]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (Auth.getSession()) { startFlitt(btn.dataset.tier, btn); return; }
        if (!payModal) { open('signup'); return; }
        sessionStorage.setItem(PENDING_KEY, btn.dataset.tier);
        lastFocus = document.activeElement;
        payModal.hidden = false;
        requestAnimationFrame(() => payModal.classList.add('is-open'));
        document.body.classList.add('is-locked');
        payModal.querySelector('#pay-login').focus();
      });
    });

    if (payModal) {
      const closePay = (keepTier) => {
        payModal.classList.remove('is-open');
        payModal.hidden = true;
        document.body.classList.remove('is-locked');
        if (!keepTier) sessionStorage.removeItem(PENDING_KEY);
        // Back to the Pay now button. When the login modal opens next
        // (keepTier), it records this button as its own focus-restore target.
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      };
      payModal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => closePay(false)));
      document.addEventListener('keydown', (e) => {
        if (payModal.hidden) return;
        if (e.key === 'Escape') closePay(false);
        else trapTab(payModal, e);
      });
      payModal.querySelector('#pay-login').addEventListener('click', () => { closePay(true); open('login'); });
      payModal.querySelector('#pay-signup').addEventListener('click', () => { closePay(true); open('signup'); });
    }

    // After an actual sign-in (modal login, or arriving back from Google /
    // a confirmation link with tokens in the URL) go to the Services page
    // (owner, 5 Nov 2026), in the page's language. Not on plain page loads
    // with an existing session, not when already on a profile page (admin.html
    // counts: an invited admin logs in there) or on the Services page itself.
    // A pending Pay now goes to Flitt; a clicked Services tile to its service.
    const arrivedWithTokens = /access_token=|[?&]code=/.test(location.hash + location.search);
    const servicesHome = document.documentElement.lang === 'ka' ? './services.ka.html' : './services.html';
    document.addEventListener('phantasma:auth', (e) => {
      if (!e.detail.session) return;
      const onProfile = /\/(account|preferences|payment-result|admin)\.html$/.test(location.pathname);
      const onServices = /\/services(\.ka)?(\.html)?$/.test(location.pathname);
      const fresh = e.detail.event === 'SIGNED_IN' && (!modal.hidden || arrivedWithTokens);
      if (!modal.hidden) close();
      if (fresh && resumePayment()) return;      // came here to pay → Flitt, not the profile
      if (fresh && resumeService()) return;      // came from a Services tile → that service
      if (fresh && !onProfile && !onServices) location.replace(servicesHome);
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
    const who   = root.querySelector('#account-who');   // identity in the title row
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

    // ---- sort / filter helpers (pure; no DOM)
    // Sort keys are the underlying values: dates as ms, '#' as a number,
    // text as text. Empty values (null, '', NaN) always go last, both directions.
    const isEmptyVal = (v) => v == null || v === '' || (typeof v === 'number' && isNaN(v));
    const dateKey = (v) => { if (!v) return null; const t = Date.parse(v); return isNaN(t) ? null : t; };
    const numKey = (v) => (v == null || v === '' ? null : Number(v));
    // One publish date per session day ('2026-10-27T…' and '2026-10-27' are the same day).
    const dayKey = (v) => { if (!v) return null; const s = String(v); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s; };
    function compareValues(a, b, dir) {
      const ea = isEmptyVal(a), eb = isEmptyVal(b);
      if (ea || eb) return ea === eb ? 0 : (ea ? 1 : -1);
      const c = typeof a === 'number' && typeof b === 'number'
        ? a - b
        : String(a).localeCompare(String(b), ['ka', 'en'], { numeric: true, sensitivity: 'base' });
      return dir === 'desc' ? -c : c;
    }
    // items: [{ r, idx }]; dir 'none' (or no key) = original order.
    function sortRecords(items, key, dir) {
      return items.slice().sort((a, b) =>
        (key && dir !== 'none' ? compareValues(key(a.r), key(b.r), dir) : 0) || a.idx - b.idx);
    }
    const nextSortDir = (dir) => (dir === 'asc' ? 'desc' : dir === 'desc' ? 'none' : 'asc');
    // Distinct publish dates, newest first.
    function publishDates(values) {
      const seen = {};
      values.forEach((v) => { const d = dayKey(v); if (d) seen[d] = true; });
      return Object.keys(seen).sort((a, b) => (dateKey(b) || 0) - (dateKey(a) || 0) || (a < b ? 1 : -1));
    }
    // choice: 'all' | 'latest' | a day key.
    function matchesPublish(value, choice, latest) {
      if (choice === 'all') return true;
      const d = dayKey(value);
      return choice === 'latest' ? d === latest : d === choice;
    }
    // ---- end sort / filter helpers

    // Company logos: normalised name (lowercase, trimmed) -> file in images/logos/.
    // Anything not listed gets a round letter badge.
    const COMPANY_LOGOS = {
      'igg': './images/logos/igg.webp',
      'insurance group of georgia': './images/logos/igg.webp',
      'bank of georgia': './images/logos/bank-of-georgia.webp',
      'tbc': './images/logos/tbc-bank.webp',
      'tbc bank': './images/logos/tbc-bank.webp',
      'terabank': './images/logos/terabank.webp',
      'silknet': './images/logos/silknet.webp',
      'silknet jsc': './images/logos/silknet.webp',
      'alta': './images/logos/alta.webp',
      'georgian beer company': './images/logos/georgian-beer-company.webp',
      'zedazeni': './images/logos/georgian-beer-company.webp',
      'taze technologies': './images/logos/taze.webp',
      'taze': './images/logos/taze.webp',
    };
    // quiet: the logo is decoration (empty alt), for places where the name
    // next to it is the whole label, e.g. inside the companies panel buttons.
    function companyCell(name, quiet) {
      const wrap = document.createElement('span');
      wrap.className = 'company';
      const src = COMPANY_LOGOS[String(name).trim().toLowerCase()];
      let mark;
      if (src) {
        mark = document.createElement('img');
        mark.className = 'company__logo';
        mark.src = src;
        mark.alt = quiet ? '' : name;
        mark.loading = 'lazy';
        mark.decoding = 'async';
      } else {
        mark = document.createElement('span');
        mark.className = 'company__badge';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = (String(name).trim().charAt(0) || '?').toUpperCase();
      }
      wrap.appendChild(mark);
      // Always show the company name next to the mark (small icons alone are not recognisable).
      const label = document.createElement('span');
      label.className = 'company__name';
      label.textContent = name;
      wrap.appendChild(label);
      return wrap;
    }

    // ---- detail row (arrow in the first column): one full-width block.
    // Every field is optional; only fields with a value are shown.
    const LANG = { ka: 'Georgian', en: 'English', ru: 'Russian' };
    let detailSeq = 0;

    // Only http(s) links from data; bare "example.com/..." gets https://.
    function safeUrl(u) {
      const s = String(u || '').trim();
      if (/^https?:\/\//i.test(s)) return s;
      if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) return 'https://' + s;
      return null;
    }
    function extLink(href, text) {
      const a = document.createElement('a');
      a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = text;
      return a;
    }
    // Long text clamped to ~6 lines; "Show more" appears only if it overflows
    // (measured when the row opens, see toggleDetail).
    function clampText(text) {
      const wrap = document.createElement('div');
      wrap.className = 't-detail__clamp';
      const p = document.createElement('p');
      p.className = 't-detail__text is-clamped';
      p.textContent = text;
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 't-detail__more';
      more.textContent = 'Show more';
      more.hidden = true;
      wrap.appendChild(p);
      wrap.appendChild(more);
      return wrap;
    }
    // A labelled clamped text (vacancy / company description).
    function textSection(title, text) {
      const sec = document.createElement('div');
      sec.className = 't-detail__section';
      const h = document.createElement('h4');
      h.className = 't-detail__h';
      h.textContent = title;
      sec.appendChild(h);
      sec.appendChild(clampText(text));
      return sec;
    }
    // r = shortlist or send row; v = its vacancy; c = the vacancy's company.
    // One full-width block: header (company · industry | dates), a wrapping
    // row of short facts, then the descriptions and the posting link.
    function detailContent(r) {
      const v = r.vacancies || {};
      const c = v.companies || {};
      const inner = document.createElement('div');
      inner.className = 't-detail__inner';
      let any = false;

      // (1) header
      const name = c.name || v.company_raw;
      const posted = v.posted_at ? fmtDate(v.posted_at) : null;
      let deadline = null, soon = null;
      if (v.deadline_at) {
        deadline = fmtDate(v.deadline_at);
        const end = new Date(v.deadline_at); end.setHours(0, 0, 0, 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const days = Math.round((end - today) / 86400000);
        if (days >= 0 && days <= 7) soon = days === 0 ? 'closes today' : days === 1 ? 'closes tomorrow' : 'closes in ' + days + ' days';
      }
      if (name || c.industry || posted || deadline) {
        any = true;
        const head = document.createElement('div');
        head.className = 't-detail__head';
        const who = document.createElement('p');
        who.className = 't-detail__who';
        if (name) {
          const b = document.createElement('strong');
          b.className = 't-detail__name';
          b.textContent = name;
          who.appendChild(b);
        }
        if (c.industry) {
          const ind = document.createElement('span');
          ind.className = 't-detail__industry';
          ind.textContent = (name ? ' · ' : '') + c.industry;
          who.appendChild(ind);
        }
        head.appendChild(who);
        if (posted || deadline) {
          const dates = document.createElement('p');
          dates.className = 't-detail__dates';
          if (posted) {
            const s = document.createElement('span');
            s.textContent = 'Posted ' + posted;
            dates.appendChild(s);
          }
          if (deadline) {
            const s = document.createElement('span');
            s.textContent = 'Deadline ' + deadline + (soon ? ' · ' + soon : '');
            if (soon) s.className = 'is-soon';
            dates.appendChild(s);
          }
          head.appendChild(dates);
        }
        inner.appendChild(head);
      }

      // (2) short facts as one wrapping row of label: value pairs
      const web = safeUrl(c.website), li = safeUrl(c.linkedin_url);
      const size = c.size_band || (c.employees ? Number(c.employees).toLocaleString('en-GB') + ' employees' : null);
      const facts = [
        ['English title', v.title_en && v.title_en !== v.title ? v.title_en : null],
        ['Location', v.location],
        ['Function', v.function],
        ['Seniority', v.seniority],
        ['Language', v.language ? (LANG[v.language] || v.language) : null],
        ['Salary', r.salary_text || v.salary_text],
        ['Why it matches', r.why_matches],
        ['HQ', c.hq_city],
        ['Size', size],
        ['Founded', c.founded_year],
        ['Website', web ? extLink(web, web.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')) : null],
        ['LinkedIn', li ? extLink(li, 'Company page') : null],
        ['Georgian name', c.name_ka && c.name_ka !== c.name ? c.name_ka : null],
      ].filter((p) => p[1] != null && p[1] !== '');
      if (facts.length) {
        any = true;
        const dl = document.createElement('dl');
        dl.className = 't-detail__facts';
        facts.forEach(([k, val]) => {
          const pair = document.createElement('div');
          pair.className = 't-detail__fact';
          const dt = document.createElement('dt'); dt.textContent = k;
          const dd = document.createElement('dd');
          if (val instanceof Node) dd.appendChild(val); else dd.textContent = String(val);
          pair.appendChild(dt); pair.appendChild(dd);
          dl.appendChild(pair);
        });
        inner.appendChild(dl);
      }

      // (3) descriptions + posting link
      if (v.description) { any = true; inner.appendChild(textSection('Vacancy', v.description)); }
      if (c.description) { any = true; inner.appendChild(textSection('About the company', c.description)); }
      const url = safeUrl(v.url);
      if (url) {
        any = true;
        const open = document.createElement('p');
        open.className = 't-detail__open';
        open.appendChild(extLink(url, 'Open original posting'));
        inner.appendChild(open);
      }

      if (!any) {
        const p = document.createElement('p');
        p.className = 't-detail__none';
        p.textContent = 'No more details yet.';
        inner.appendChild(p);
      }
      return inner;
    }

    // Open / close one detail row; measure clamps once visible.
    function toggleDetail(btn) {
      const row = document.getElementById(btn.getAttribute('aria-controls'));
      if (!row) return;
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      row.hidden = !open;
      if (!open) return;
      pBody.style.setProperty('--detail-w', pBody.clientWidth + 'px');
      row.querySelectorAll('.t-detail__clamp').forEach((w) => {
        const p = w.firstChild, more = w.lastChild;
        if (!p.classList.contains('is-clamped')) return;
        more.hidden = p.scrollHeight <= p.clientHeight + 1;
      });
    }
    pBody.addEventListener('click', (e) => {
      const tog = e.target.closest('.t-toggle__btn');
      if (tog) { toggleDetail(tog); return; }
      const co = e.target.closest('.co__toggle');
      if (co) { toggleCompany(co); return; }
      const more = e.target.closest('.t-detail__more');
      if (more) {
        const p = more.previousElementSibling;
        const clamped = p.classList.toggle('is-clamped');
        more.textContent = clamped ? 'Show more' : 'Show less';
      }
    });
    // Keep the detail panel as wide as the visible table area (phones scroll the table).
    window.addEventListener('resize', () => {
      if (pBody.querySelector('.t-detail:not([hidden])')) pBody.style.setProperty('--detail-w', pBody.clientWidth + 'px');
    });

    // ---- table builders (text via textContent; only hrefs come from data)
    // opts.cls: extra table class; opts.detail(r) -> position name, enables
    // the arrow column + an expandable detail row under each row.
    // A header { text, sort: (r) => value } makes that column sortable
    // (button in the <th>, aria-sort; asc → desc → original order).
    // opts.filter { key, get: (r) => publish date } adds the "Publish date"
    // select above the table; the choice is kept per key in sessionStorage.
    const tableRefresh = new WeakMap();   // tbody -> recount after a row is removed
    function table(headers, rows, cells, opts) {
      opts = opts || {};
      if (!rows.length) {
        const p = document.createElement('p');
        p.className = 'account__empty';
        p.textContent = 'Nothing here yet.';
        return p;
      }
      const t = document.createElement('table');
      t.className = 'account-table' + (opts.cls ? ' ' + opts.cls : '');
      const thead = t.createTHead().insertRow();
      if (opts.detail) {
        const th = document.createElement('th');
        th.className = 't-toggle';
        const sr = document.createElement('span');
        sr.className = 'visually-hidden';
        sr.textContent = 'Details';
        th.appendChild(sr);
        thead.appendChild(th);
      }
      const recs = [];                 // { r, idx, tr, dr, btn } in original order
      const sortThs = [];
      let sortBy = -1, sortDir = 'none';
      headers.forEach((h, i) => {
        const th = document.createElement('th');
        const text = typeof h === 'string' ? h : h.text;
        if (h.cls) th.className = h.cls;
        if (h.title) th.title = h.title;
        if (h.sort) {
          th.setAttribute('aria-sort', 'none');
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 't-sort';
          b.textContent = text;
          const arrow = document.createElement('span');
          arrow.className = 't-sort__arrow';
          arrow.setAttribute('aria-hidden', 'true');
          b.appendChild(arrow);
          b.addEventListener('click', () => sortTable(i));
          th.appendChild(b);
          sortThs[i] = th;
        } else {
          th.textContent = text;
        }
        thead.appendChild(th);
      });
      // Re-append each row together with its detail row (open state kept).
      function sortTable(i) {
        sortDir = sortBy === i ? nextSortDir(sortDir) : 'asc';
        sortBy = sortDir === 'none' ? -1 : i;
        sortThs.forEach((th, j) => {
          if (th) th.setAttribute('aria-sort', j === sortBy ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
        });
        const live = recs.filter((x) => x.tr.isConnected);
        sortRecords(live, sortBy < 0 ? null : headers[sortBy].sort, sortDir).forEach((x) => {
          tb.appendChild(x.tr);
          if (x.dr) tb.appendChild(x.dr);
        });
      }
      const tb = t.createTBody();
      rows.forEach((r, idx) => {
        const tr = tb.insertRow();
        const rec = { r, idx, tr, dr: null, btn: null };
        recs.push(rec);
        let btn = null;
        if (opts.detail) {
          const id = 'detail-' + (++detailSeq);
          const td = tr.insertCell();
          td.className = 't-toggle';
          btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 't-toggle__btn';
          btn.setAttribute('aria-expanded', 'false');
          btn.setAttribute('aria-controls', id);
          btn.setAttribute('aria-label', 'Show details for ' + (opts.detail(r) || 'this vacancy'));
          const chev = document.createElement('span');
          chev.className = 't-toggle__chev';
          chev.setAttribute('aria-hidden', 'true');
          btn.appendChild(chev);
          td.appendChild(btn);
          tr.dataset.detail = id;
        }
        cells(r).forEach((c) => {
          const td = tr.insertCell();
          if (c instanceof Node) {
            td.appendChild(c);               // a ready-made cell, e.g. a status label
          } else if (c && c.check) {
            td.className = 't-send';
            const lab = document.createElement('label');
            lab.className = 'send-check';
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.checked = !!c.on;
            if (c.locked) {
              // Already sent = approved (CAR-17): ticked for good, no data-id,
              // so the change handler below never sees it.
              box.checked = true;
              box.disabled = true;
              lab.classList.add('is-locked');
              lab.title = "Already sent — can't be undone";
              box.setAttribute('aria-label', "Application already sent for this vacancy — can't be undone");
              lab.appendChild(box);
              const mark = document.createElement('span');
              mark.className = 'send-check__mark';
              mark.setAttribute('aria-hidden', 'true');
              mark.textContent = 'Sent';
              lab.appendChild(mark);
            } else {
              box.dataset.id = c.id;
              box.setAttribute('aria-label', 'Send my application for this vacancy');
              lab.appendChild(box);
            }
            td.appendChild(lab);
          } else if (c && c.company !== undefined) {
            td.appendChild(companyCell(c.company));
          } else if (c && typeof c === 'object' && 'text' in c) {
            // { href, text, sub }: a link when href is a safe http(s) URL,
            // plain text otherwise (a vacancy hidden by RLS has neither).
            const href = safeUrl(c.href);
            const main = document.createElement(href ? 'a' : 'span');
            if (href) { main.href = href; main.target = '_blank'; main.rel = 'noopener noreferrer'; }
            main.textContent = c.text == null || c.text === '' ? '—' : c.text;
            td.appendChild(main);
            if (c.sub) { const s = document.createElement('span'); s.className = 't-sub'; s.textContent = c.sub; td.appendChild(s); }
          } else {
            td.textContent = c == null ? '—' : c;
          }
        });
        if (btn) {
          // Full-width row under it, collapsed by default.
          const dr = tb.insertRow();
          dr.id = btn.getAttribute('aria-controls');
          dr.className = 't-detail';
          dr.hidden = true;
          const td = dr.insertCell();
          td.colSpan = tr.cells.length;
          td.appendChild(detailContent(r));
          rec.dr = dr; rec.btn = btn;
        }
      });
      if (!opts.filter) return t;

      // ---- "Publish date" filter above the table
      const get = opts.filter.get;
      const dates = publishDates(rows.map(get));
      const bar = document.createElement('div');
      bar.className = 't-filter';
      // Multi-select: a <details> menu of checkboxes, one per publish date.
      const menuId = 'pubdate-' + (++detailSeq);
      const lab = document.createElement('span');
      lab.className = 't-filter__label';
      lab.id = menuId + '-label';
      lab.textContent = 'Publish date:';
      const menu = document.createElement('details');
      menu.className = 't-filter__menu';
      const summary = document.createElement('summary');
      summary.className = 't-filter__select';
      summary.setAttribute('aria-labelledby', lab.id + ' ' + menuId + '-sum');
      const sumText = document.createElement('span');
      sumText.id = menuId + '-sum';
      summary.appendChild(sumText);
      menu.appendChild(summary);
      const panel = document.createElement('div');
      panel.className = 't-filter__panel';
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-labelledby', lab.id);
      const quick = document.createElement('div');
      quick.className = 't-filter__quick';
      const allBtn = document.createElement('button');
      allBtn.type = 'button'; allBtn.className = 't-filter__qbtn'; allBtn.textContent = 'All dates';
      const latestBtn = document.createElement('button');
      latestBtn.type = 'button'; latestBtn.className = 't-filter__qbtn'; latestBtn.textContent = 'Latest only';
      quick.appendChild(allBtn); quick.appendChild(latestBtn);
      panel.appendChild(quick);
      const boxes = dates.map((d) => {
        const l = document.createElement('label');
        l.className = 't-filter__opt';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.value = d;
        l.appendChild(cb);
        l.appendChild(document.createTextNode(' ' + fmtDate(d)));
        panel.appendChild(l);
        return cb;
      });
      menu.appendChild(panel);
      const count = document.createElement('span');
      count.className = 't-filter__count';
      count.setAttribute('aria-live', 'polite');
      bar.appendChild(lab);
      bar.appendChild(menu);
      bar.appendChild(count);

      // Saved choice: JSON array of day keys; empty array = all dates.
      const storeKey = 'phantasma_pubdates_' + opts.filter.key;
      let saved = [];
      try { saved = JSON.parse(sessionStorage.getItem(storeKey) || '[]') || []; } catch (e) { saved = []; }
      boxes.forEach((cb) => { cb.checked = saved.indexOf(cb.value) !== -1; });

      function chosen() { return boxes.filter((cb) => cb.checked).map((cb) => cb.value); }
      function applyFilter() {
        const pick = chosen();
        const live = recs.filter((x) => x.tr.parentNode);
        let n = 0;
        live.forEach((x) => {
          const show = !pick.length || pick.indexOf(dayKey(get(x.r))) !== -1;
          x.tr.hidden = !show;
          if (x.dr) x.dr.hidden = !show || x.btn.getAttribute('aria-expanded') !== 'true';
          if (show) n++;
        });
        sumText.textContent = !pick.length ? 'All dates'
          : pick.length === 1 ? fmtDate(pick[0]) : pick.length + ' dates';
        count.textContent = 'Showing ' + n + ' of ' + live.length;
        try { sessionStorage.setItem(storeKey, JSON.stringify(pick)); } catch (e) { /* storage blocked */ }
      }
      boxes.forEach((cb) => cb.addEventListener('change', applyFilter));
      allBtn.addEventListener('click', () => { boxes.forEach((cb) => { cb.checked = false; }); applyFilter(); });
      latestBtn.addEventListener('click', () => { boxes.forEach((cb, i) => { cb.checked = i === 0; }); applyFilter(); });
      // The list floats over the table (fixed position), so opening it never pushes the table down.
      function placePanel() {
        const r = summary.getBoundingClientRect();
        panel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - panel.offsetWidth - 8)) + 'px';
        panel.style.top = (r.bottom + 4) + 'px';
      }
      menu.addEventListener('toggle', () => { if (menu.open) placePanel(); });
      window.addEventListener('scroll', (e) => { if (menu.open && !panel.contains(e.target)) menu.open = false; }, true);
      window.addEventListener('resize', () => { if (menu.open) placePanel(); });
      // Close the menu on outside click or Esc.
      document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
      menu.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; summary.focus(); } });
      tableRefresh.set(tb, applyFilter);
      applyFilter();

      const frag = document.createDocumentFragment();
      frag.appendChild(bar);
      frag.appendChild(t);
      return frag;
    }

    // Sort key for the company columns ('—' placeholder counts as empty).
    const companyKey = (r) => { const c = company(r.vacancies); return c === '—' ? null : c; };
    const titleKey = (r) => (r.vacancies && r.vacancies.title) || null;

    // Owner rule (CAR-17, 5 Nov 2026): a vacancy we have sent counts as
    // approved. In every vacancy list its Send tick is checked and locked, and
    // it always counts as "Selected by you". Shortlist rows carry the vacancy
    // id as vacancies.id, sends as vacancy_id.
    const vacIdOf = (r) => (r.vacancies && r.vacancies.id != null ? r.vacancies.id : r.vacancy_id);
    const sentIds = (d) => new Set(d.sends.map((s) => String(s.vacancy_id)));
    const isSent = (sent, r) => { const id = vacIdOf(r); return id != null && sent.has(String(id)); };

    // "Publish date" = the date the shortlist was published to the client
    // (the scraping session date, column shortlists.week).
    // sent = sentIds(data), for the locked ticks.
    function vacancyRows(rows, key, sent) {
      return table(
        [{ text: 'Publish date', sort: (r) => dateKey(r.week) },
         { text: '#', sort: (r) => numKey(r.rank) },
         { text: 'Company', sort: companyKey },
         { text: 'Position', sort: titleKey },
         { text: 'Why it matches', sort: (r) => r.why_matches || short((r.vacancies || {}).description, 140) || null },
         { text: 'Source', sort: (r) => { const v = r.vacancies || {}; return SOURCE[v.source] || v.source || null; } },
         { text: 'Deadline', sort: (r) => dateKey((r.vacancies || {}).deadline_at) },
         { text: 'Send', cls: 't-send', title: 'Tick to have us send your application, with your CV, to this company.' }],
        rows,
        (r) => {
          const v = r.vacancies || {};
          return [
            fmtDate(r.week), r.rank,
            { company: company(v) },
            { href: v.url, text: v.title || '—', sub: [v.location, r.salary_text].filter(Boolean).join(' · ') },
            r.why_matches || short(v.description, 140),
            SOURCE[v.source] || v.source,
            fmtDate(v.deadline_at),
            { check: true, id: r.id, on: r.client_decision === 'interested', locked: isSent(sent, r) },
          ];
        },
        { cls: 'account-table--vac', detail: (r) => (r.vacancies && r.vacancies.title) || '',
          filter: { key: key, get: (r) => r.week } });
    }

    // "Selected by you" = rows the client ticked (client_decision = interested)
    // plus every sent vacancy, once per vacancy, so it is never lower than
    // "Applications sent". A sent vacancy that is in no shortlist gets a
    // read-only stand-in row (no shortlist id, no publish date, locked tick).
    function selectedRows(d) {
      const sent = sentIds(d);
      const seen = new Set();
      const rows = [];
      d.shortlists.forEach((r) => {
        if (r.client_decision !== 'interested' && !isSent(sent, r)) return;
        const id = vacIdOf(r);
        const k = id != null ? 'v' + id : 'r' + r.id;
        if (seen.has(k)) return;
        seen.add(k);
        rows.push(r);
      });
      d.sends.forEach((s) => {
        const k = 'v' + s.vacancy_id;
        if (seen.has(k)) return;
        seen.add(k);
        rows.push({ id: null, week: null, rank: null, client_decision: null, why_matches: null,
                    salary_text: null, vacancy_id: s.vacancy_id, vacancies: s.vacancies });
      });
      return rows;
    }

    // Checkbox → shortlists.client_decision (the only column a client may write).
    // Locked (sent) ticks carry no data-id and are disabled, so they never get here.
    pBody.addEventListener('change', async (e) => {
      const box = e.target;
      if (box.type !== 'checkbox' || !box.dataset.id || box.closest('.send-check.is-locked')) return;
      const row = data.shortlists.find((r) => String(r.id) === box.dataset.id);
      if (!row) return;
      const next = box.checked ? 'interested' : null;
      box.disabled = true;
      const { error } = await Auth.db().from('shortlists').update({ client_decision: next }).eq('id', row.id);
      box.disabled = false;
      if (error) { box.checked = !box.checked; console.warn('decision not saved', error.message); return; }
      row.client_decision = next;
      const n = selectedRows(data).length;
      const el = root.querySelector('[data-stat="selected"]');
      el.textContent = n; el.dataset.countTo = String(n);
      if (openKey === 'selected' && !box.checked) {
        const tr = box.closest('tr');
        const refresh = tableRefresh.get(tr.parentNode);
        const dr = tr.dataset.detail && document.getElementById(tr.dataset.detail);
        if (dr) dr.remove();
        tr.remove();
        if (refresh) refresh();          // "Showing N of M" counts the remaining rows
      }
    });

    function sendRows(rows) {
      return table(
        [{ text: 'Company', sort: companyKey },
         { text: 'Position', sort: titleKey },
         { text: 'Sent', sort: (r) => dateKey(r.sent_at) },
         { text: 'Outcome', sort: (r) => OUTCOME[r.outcome] || r.outcome || null },
         { text: 'Updated', sort: (r) => dateKey(r.outcome_at) }],
        rows,
        (r) => {
          const v = r.vacancies || {};
          return [{ company: company(v) }, { href: v.url, text: v.title || '—' }, fmtDate(r.sent_at), OUTCOME[r.outcome] || r.outcome, fmtDate(r.outcome_at)];
        },
        { cls: 'account-table--sends', detail: (r) => (r.vacancies && r.vacancies.title) || '' });
    }

    // ---- Companies panel (7 Nov 2026, owner answer V-12): one row per
    // company (logo + name, industry, number of matched vacancies), most
    // matches first. Its arrow opens a compact table of that company's
    // matched vacancies: Title, Announced (posted_at), Deadline, Match
    // (shortlists.score as a whole %, "—" while empty: CAR-18), Status.
    // A vacancy in several weekly lists counts once: chosen if any of its
    // rows is ticked, with its best match %.
    const VAC_STATUS = {
      replied: 'Employer replied',
      sent:    'Sent',
      passed:  'Deadline passed',
      chosen:  'Chosen — waiting to send',
      none:    'Not chosen',
    };
    // "Employer replied" = a send whose outcome is an answer from the
    // employer. Reply tracking (D-27) will feed this later; today no send
    // carries such an outcome, so it does not show yet.
    const REPLY_OUTCOMES = { interview: true, offer: true, rejected: true };
    // Local midnight of a date column ('YYYY-MM-DD' is a local day, not UTC).
    function dayStart(v) {
      if (!v) return null;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
      const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
      if (isNaN(d)) return null;
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    // Status, first that applies: Employer replied, Sent, Deadline passed
    // (before today and not sent), Chosen — waiting to send, Not chosen.
    function companyGroups(d) {
      const sendOf = {};
      d.sends.forEach((s) => { sendOf[String(s.vacancy_id)] = s; });
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const groups = {}, seen = {};
      d.shortlists.forEach((r) => {
        const v = r.vacancies || {};
        const id = vacIdOf(r);
        const k = id != null ? 'v' + id : 'r' + r.id;
        let x = seen[k];
        if (!x) {
          const name = company(r.vacancies);
          const g = groups[name] || (groups[name] = { name, industry: null, items: [] });
          if (!g.industry && v.companies && v.companies.industry) g.industry = v.companies.industry;
          x = seen[k] = { v, score: null, chosen: false, send: id != null ? sendOf[String(id)] || null : null };
          g.items.push(x);
        }
        if (r.client_decision === 'interested') x.chosen = true;
        const sc = numKey(r.score);
        if (sc != null && !isNaN(sc) && (x.score == null || sc > x.score)) x.score = sc;
      });
      const list = Object.keys(groups).map((n) => groups[n]);
      list.forEach((g) => {
        g.items.forEach((x) => {
          x.end = dayStart(x.v.deadline_at);
          x.past = x.end != null && x.end < today.getTime();
          x.status = x.send ? (REPLY_OUTCOMES[x.send.outcome] ? 'replied' : 'sent')
            : x.past ? 'passed' : x.chosen ? 'chosen' : 'none';
        });
        // Best match first (empty last), then by deadline: open ones soonest
        // first, then those without a deadline, then the passed ones.
        g.items.sort((a, b) => compareValues(a.score, b.score, 'desc')
          || (a.past - b.past)
          || compareValues(a.end, b.end, 'asc')
          || compareValues(a.v.title || null, b.v.title || null, 'asc'));
      });
      // Most matched vacancies first; vacancies without a company name last.
      return list.sort((a, b) => ((a.name === '—') - (b.name === '—'))
        || (b.items.length - a.items.length) || compareValues(a.name, b.name, 'asc'));
    }

    function companiesPanel(d) {
      const groups = companyGroups(d);
      if (!groups.length) return table([], [], () => []);   // "Nothing here yet."
      const frag = document.createDocumentFragment();
      const hint = document.createElement('p');
      hint.className = 'account__hint co-hint';
      hint.textContent = 'Open a company to see the vacancies we matched there.';
      frag.appendChild(hint);
      const list = document.createElement('ul');
      list.className = 'co-list';
      const span = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };
      groups.forEach((g) => {
        const id = 'co-' + (++detailSeq);
        const name = g.name === '—' ? 'Company not named' : g.name;
        const li = document.createElement('li');
        li.className = 'co';
        const h = document.createElement('h3');
        h.className = 'co__h';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'co__toggle';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', id);
        const arrow = span('co__arrow', '');
        arrow.setAttribute('aria-hidden', 'true');
        arrow.appendChild(span('t-toggle__chev', ''));
        btn.appendChild(arrow);
        btn.appendChild(companyCell(name, true));
        if (g.industry) btn.appendChild(span('co__industry', g.industry));
        const n = g.items.length;
        btn.appendChild(span('co__count', n + ' matched ' + (n === 1 ? 'vacancy' : 'vacancies')));
        h.appendChild(btn);
        li.appendChild(h);

        const body = document.createElement('div');
        body.className = 'co__body';
        body.id = id;
        body.hidden = true;
        const t = table(['Title', 'Announced', 'Deadline', 'Match', 'Status'], g.items, (x) => [
          { href: x.v.url, text: x.v.title || '—' },
          fmtDate(x.v.posted_at),
          fmtDate(x.v.deadline_at),
          x.score == null ? '—' : Math.round(Math.max(0, Math.min(100, x.score))) + '%',
          (() => { const s = span('co-status', VAC_STATUS[x.status]); s.dataset.status = x.status; return s; })(),
        ], { cls: 'account-table--co' });
        const cap = t.createCaption();
        cap.className = 'visually-hidden';
        cap.textContent = 'Matched vacancies at ' + name;
        body.appendChild(t);
        li.appendChild(body);
        list.appendChild(li);
      });
      frag.appendChild(list);
      return frag;
    }

    function toggleCompany(btn) {
      const body = document.getElementById(btn.getAttribute('aria-controls'));
      if (!body) return;
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      body.hidden = !open;
    }

    const PANELS = {
      weeks: {
        title: 'Weekly runs',
        build: (d) => {
          const byWeek = {};
          d.shortlists.forEach((r) => { byWeek[r.week] = (byWeek[r.week] || 0) + 1; });
          const rows = Object.keys(byWeek).sort().reverse().map((w, i, arr) => ({ n: arr.length - i, week: w, count: byWeek[w] }));
          return table(['Run', 'Date', 'Vacancies shortlisted'], rows, (r) => ['Run ' + r.n, fmtDate(r.week), r.count]);
        },
      },
      companies:  { title: 'Companies reviewed', build: companiesPanel },
      processed:  { title: 'Vacancies processed', build: (d) => vacancyRows(d.shortlists, 'processed', sentIds(d)) },
      selected:   { title: 'Selected by you', build: (d) => vacancyRows(selectedRows(d), 'selected', sentIds(d)) },
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

    // Tile tone by meaning, from the numbers already loaded (never invented):
    // ok = progress made, watch = nothing yet / waiting, act = your move.
    // Outcomes (interviews, offers) are neutral at zero: a zero is not a fault.
    const TONE_TEXT = { ok: 'On track', watch: 'Waiting', act: 'Your move' };
    const TONE_ICON = { ok: '✓', watch: '…', act: '!' };
    function toneFor(key, n, all) {
      if (key === 'interviews' || key === 'offers') return n > 0 ? 'ok' : '';
      if (key === 'selected') return n > 0 ? 'ok' : (all.processed > 0 ? 'act' : 'watch');
      return n > 0 ? 'ok' : 'watch';
    }
    function paintTones(nums) {
      Object.keys(nums).forEach((k) => {
        const tile = grid.querySelector('[data-panel="' + k + '"]');
        if (!tile) return;
        const tone = toneFor(k, nums[k], nums);
        let flag = tile.querySelector('.stat__flag');
        if (!tone) { if (flag) flag.remove(); tile.removeAttribute('data-tone'); return; }
        tile.dataset.tone = tone;
        if (!flag) {
          flag = document.createElement('span');
          flag.className = 'stat__flag';
          tile.insertBefore(flag, tile.querySelector('.stat__value'));
        }
        flag.innerHTML = '';
        const ic = document.createElement('span');
        ic.className = 'stat__flag-icon';
        ic.setAttribute('aria-hidden', 'true');
        ic.textContent = TONE_ICON[tone];
        flag.appendChild(ic);
        flag.appendChild(document.createTextNode(TONE_TEXT[tone]));
      });
    }

    function renderStats(d) {
      const st = d.stats;
      const nums = {
        weeks:      d.weeks,
        processed:  st ? st.vacancies_processed : 0,
        companies:  st ? st.companies_processed : 0,
        selected:   selectedRows(d).length,
        sent:       st ? st.applications_sent   : 0,
        interviews: st ? st.interviews          : 0,
        offers:     st ? st.offers              : 0,
      };
      Object.keys(nums).forEach((k) => {
        const el = root.querySelector('[data-stat="' + k + '"]');
        el.textContent = nums[k];
        el.dataset.countTo = String(nums[k]);
      });
      paintTones(nums);
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
      if (who) who.hidden = !session;
      closePanel();
      current = session;                                // Profile details + My simple CV read it
      startMatch(session);                              // Start matching: its place is kept until its data is in
      if (!session) { nameEl.hidden = true; prefsRow = null; cand = null; return; }   // the name sits outside #account-who
      paintLogin(session);                              // login icon (8 Nov 2026; the email text is gone)
      paintStatus(stLi, hasLinkedIn(session));
      fillLogin(); fillLinkedIn();                      // Profile details, should it be open
      Auth.loadProfile().then(({ data: p }) => {
        profile = p || {}; paintProfile();
        cvPath = (p && p.cv_path) || null; paintCv();
      }, () => matchSet({ cv: !!cvPath }));
      Auth.loadPreferences().then(({ data: pr }) => {
        prefsRow = pr || null; fillPrefs();
        paintPrefs(prefsPct(pr)); matchSet({ need: missingPrefs(pr) });
      }, () => { paintPrefs(0); matchSet({ need: missingPrefs(null) }); });
      Auth.loadCandidate().then(({ data: c, error }) => {
        if (error) console.warn('account: candidate read failed', error.message);
        cand = (!error && c) || null; fillCv();
      }, () => {});
      data = await Auth.loadStats();
      if (data.errors.length) console.warn('account: query failed', data.errors.map((e) => e.message));
      workbookPath = data.workbook;
      wb.hidden = !workbookPath;
      paintAudit(data.audit);
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

    // ---- small modal controller (same conventions as the login modal).
    // Dialogs can stack (8 Nov 2026: Review my CV and My simple CV open on
    // top of Profile details): only the top one answers Esc / Tab, and the
    // page stays locked until the last one closes. onClose runs on every close.
    const openModals = [];
    function modalCtl(el, onClose) {
      let lastFocus = null;
      function open(focusSel) {
        lastFocus = document.activeElement;
        el.hidden = false;
        if (openModals.indexOf(el) === -1) openModals.push(el);
        requestAnimationFrame(() => el.classList.add('is-open'));
        document.body.classList.add('is-locked');
        const f = focusSel && el.querySelector(focusSel);
        if (f) f.focus();
      }
      function close() {
        el.classList.remove('is-open');
        el.hidden = true;
        const i = openModals.indexOf(el);
        if (i !== -1) openModals.splice(i, 1);
        if (!openModals.length) document.body.classList.remove('is-locked');
        if (onClose) onClose();
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }
      el.querySelectorAll('[data-close]').forEach((c) => c.addEventListener('click', close));
      document.addEventListener('keydown', (e) => {
        // defaultPrevented: the Esc that just closed the dialog above this one
        if (el.hidden || e.defaultPrevented || openModals[openModals.length - 1] !== el) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else trapTab(el, e);
      });
      return { open, close, get isOpen() { return !el.hidden; } };
    }

    // ---- profile details modal (names + LinkedIn link, editable). Since 8 Nov
    // 2026 also everything else we show about the person, grouped by where it
    // comes from (login, LinkedIn, CV, preferences), plus My simple CV. The
    // fill*() functions paint one group each and run again when its data
    // arrives, so an open dialog stays current; they never touch the inputs.
    let profile = {};
    let current = null;     // the session render() painted last
    let prefsRow = null;    // the own preferences row (null = nothing saved)
    let cand = null;        // the own candidates row (null = none yet)
    const pfEl    = document.getElementById('profile-modal');
    const pfModal = modalCtl(pfEl);
    const pfForm  = document.getElementById('profile-form');
    const pfNote  = document.getElementById('profile-status');
    const nameEl  = root.querySelector('#account-name');   // next to the title (5 Nov 2026)
    const slugOf  = (u) => { const m = /linkedin\.com\/in\/([^/?#]+)/i.exec(u || ''); return m ? m[1] : ''; };
    const pfSay   = (kind, text) => { pfNote.textContent = text; pfNote.dataset.kind = kind; pfNote.hidden = !text; };
    const clean   = (v) => (v == null ? '' : String(v).trim());
    // '{a} of {b}' + { a, b } → text. Values go in as they are (an email with
    // "$&" in it would trip String.replace's patterns).
    const fillIn  = (tpl, map) => String(tpl || '').replace(/\{(\w+)\}/g,
      (m, k) => (Object.prototype.hasOwnProperty.call(map, k) ? String(map[k]) : m));
    const jsonData = (el, key) => { try { return JSON.parse((el && el.dataset[key]) || '{}'); } catch (_e) { return {}; } };
    const PF_WORDS = jsonData(pfEl, 'providers');            // "Signed in with" values

    // The LinkedIn link is edited only here, in Profile details (the header
    // line with the slug and Edit / Add was removed 5 Nov 2026).
    function paintProfile() {
      const full = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ');
      nameEl.textContent = full;
      nameEl.hidden = !full;
    }
    function openProfile() {
      ['first_name', 'middle_name', 'last_name', 'linkedin_url'].forEach((k) => { pfForm[k].value = profile[k] || ''; });
      pfSay('', '');
      pfLiNote.hidden = true;
      pfModal.open('#pf-first');
      fillProfile();                       // after open: the LinkedIn photo is fetched only now
    }
    root.querySelector('#account-profile-btn').addEventListener('click', openProfile);

    // The way the person signed in: app_metadata.provider (the method the
    // account was made with). Anything unknown counts as email.
    function provKey(s) {
      const p = clean(s && s.user && s.user.app_metadata && s.user.app_metadata.provider);
      return p === 'google' ? 'google' : (p === 'linkedin_oidc' || p === 'linkedin') ? 'linkedin_oidc' : 'email';
    }
    // That provider's logo (from <template id="login-logos">), first in box.
    const logoTpl = document.getElementById('login-logos');
    function setLogo(box, key) {
      if (!box || box.dataset.provider === key) return;
      const old = box.querySelector('svg');
      if (old) old.remove();
      const logo = logoTpl && logoTpl.content.querySelector('[data-logo="' + key + '"]');
      if (logo) box.insertBefore(logo.cloneNode(true), box.firstChild);
      box.dataset.provider = key;
    }
    // One label / value row (value: text or a node); no value → row hidden.
    function setRow(row, value) {
      if (!row) return false;
      const dd = row.querySelector('dd');
      dd.textContent = '';
      if (value && typeof value === 'object') dd.appendChild(value);
      else dd.textContent = value || '';
      row.hidden = !value;
      return !!value;
    }
    const pfRow = (kind, key) => pfEl.querySelector('[data-' + kind + '="' + key + '"]');

    // From your login: the session.
    function fillLogin() {
      const s = current;
      if (!s || !s.user) return;
      const key = provKey(s);
      setLogo(document.getElementById('pf-login-badge'), key);
      setRow(pfRow('login', 'email'), clean(s.user.email));
      setRow(pfRow('login', 'provider'), PF_WORDS[key] || key);
      setRow(pfRow('login', 'since'), s.user.created_at ? fmtDate(s.user.created_at) : '');
    }

    // From LinkedIn: what LinkedIn gave us when it was connected (the OpenID
    // claims in the linkedin_oidc identity's identity_data). Not connected:
    // one line + Connect LinkedIn (the same action as the status button).
    const pfLiOn    = document.getElementById('pf-li-on');
    const pfLiOff   = document.getElementById('pf-li-off');
    const pfLiPhoto = document.getElementById('pf-li-photo');
    const pfLiNote  = document.getElementById('pf-li-note');
    pfLiPhoto.addEventListener('error', () => { pfLiPhoto.hidden = true; });   // e.g. LinkedIn's photo link expired
    function fillLinkedIn() {
      const s = current;
      if (!s || !s.user) return;
      const id = (s.user.identities || []).find((i) => i.provider === 'linkedin_oidc');
      pfLiOn.hidden = !id;
      pfLiOff.hidden = !!id;
      if (!id) return;
      const d = id.identity_data || {};
      setRow(pfRow('li', 'name'), clean(d.name || d.full_name || [d.given_name, d.family_name].filter(Boolean).join(' ')));
      setRow(pfRow('li', 'email'), clean(d.email));
      const pic = clean(d.picture || d.avatar_url);
      if (!/^https:\/\//i.test(pic)) { pfLiPhoto.hidden = true; pfLiPhoto.removeAttribute('src'); return; }
      if (!pfModal.isOpen) return;          // no request to LinkedIn until the dialog is open
      if (pfLiPhoto.getAttribute('src') !== pic) pfLiPhoto.src = pic;
      pfLiPhoto.hidden = false;
    }
    document.getElementById('pf-li-connect').addEventListener('click', () => connectLinkedIn(pfLiNote));

    // From your CV: the file (profiles.cv_path / cv_uploaded_at), then what
    // the pipeline read from it (the candidates row; none yet → one line).
    const pfCvBtn   = document.getElementById('pf-cv-btn');
    const pfCvFile  = document.getElementById('pf-cv-file');
    const pfCvReadH = document.getElementById('pf-cv-read-h');
    const pfCvRead  = document.getElementById('pf-cv-read');
    const pfCvNone  = document.getElementById('pf-cv-none');
    function fillCv() {
      pfCvBtn.textContent = cvPath ? pfCvBtn.dataset.labelReview : pfCvBtn.dataset.labelUpload;
      pfCvFile.textContent = !cvPath ? pfCvFile.dataset.none
        : profile.cv_uploaded_at ? fillIn(pfCvFile.dataset.fmt, { file: cvShownName(), date: fmtDate(profile.cv_uploaded_at) })
        : cvShownName();
      let any = false;
      pfCvRead.querySelectorAll('[data-cand]').forEach((row) => {
        const k = row.dataset.cand;
        const v = clean(cand && cand[k]);
        let value = v;
        if (k === 'profile_url') {
          const url = safeUrl(v);
          value = url ? extLink(url, url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')) : '';
        }
        if (setRow(row, value)) any = true;
      });
      pfCvReadH.hidden = !any;
      pfCvRead.hidden = !any;
      pfCvNone.hidden = any;
    }

    // From your preferences: salary range, q5 / q20 / q22 and the count.
    const pfPrefs = document.getElementById('pf-prefs');
    const pfCount = document.getElementById('pf-prefs-count');
    // An answer as text: what was typed, or a list (older rows) joined.
    function answerText(v) {
      if (typeof v === 'string') return v.trim();
      if (typeof v === 'number') return String(v);
      if (Array.isArray(v)) return v.map(clean).filter(Boolean).join(', ');
      return '';
    }
    function salaryText(p) {
      if (!p) return '';
      const has = (v) => v != null && v !== '';
      const num = (v) => (isNaN(Number(v)) ? clean(v) : Number(v).toLocaleString('en-GB'));
      const lo = has(p.salary_min), hi = has(p.salary_max);
      const t = pfPrefs.dataset;
      const tpl = lo && hi ? t.salaryRange : lo ? t.salaryMin : hi ? t.salaryMax : '';
      return fillIn(tpl, { min: lo ? num(p.salary_min) : '', max: hi ? num(p.salary_max) : '', cur: clean(p.currency) || 'GEL' });
    }
    function fillPrefs() {
      const a = (prefsRow && prefsRow.answers) || {};
      let any = false;
      pfPrefs.querySelectorAll('[data-pref]').forEach((row) => {
        const k = row.dataset.pref;
        if (setRow(row, k === 'salary' ? salaryText(prefsRow) : answerText(a[k]))) any = true;
      });
      pfPrefs.hidden = !any;
      pfCount.textContent = fillIn(pfCount.dataset.label, { n: prefsCount(prefsRow) });
    }

    function fillProfile() { fillLogin(); fillLinkedIn(); fillCv(); fillPrefs(); }

    // ---- status controls in the title row (5 Nov 2026): LinkedIn connected
    // (a linkedin_oidc identity on the login), CV uploaded, preferences filled.
    // Each shows its state in the icon (green check) and in aria-label + title.
    // 8 Nov 2026: first of them the login icon, which replaced the email text:
    // the provider's logo, always checked; "Signed in with Google as
    // name@example.com" is its name and its tooltip (no title, see the
    // tooltips at the end); a click opens Profile details.
    const stLogin    = root.querySelector('#status-login');
    const stLoginTip = root.querySelector('#status-login-tip');
    const LOGIN_WORDS = jsonData(stLogin, 'providers');      // google → "Google", email → "email", …
    function paintLogin(s) {
      if (!stLogin || !s || !s.user) return;
      const key = provKey(s);
      const email = clean(s.user.email);
      const label = fillIn(email ? stLogin.dataset.label : stLogin.dataset.labelNoEmail,
                           { provider: LOGIN_WORDS[key] || key, email });
      stLogin.setAttribute('aria-label', label);
      stLoginTip.textContent = label;
      setLogo(stLogin, key);
    }
    if (stLogin) stLogin.addEventListener('click', openProfile);
    const stLi    = root.querySelector('#status-linkedin');
    const stCv    = root.querySelector('#status-cv');
    const stPrefs = root.querySelector('#status-prefs');
    const stPct   = root.querySelector('#status-prefs-pct');
    const stNote  = root.querySelector('#status-note');
    function paintStatus(btn, on) {
      btn.dataset.state = on ? 'on' : 'off';
      const label = btn.dataset[on ? 'labelOn' : 'labelOff'];
      btn.setAttribute('aria-label', label);
      btn.title = label;
    }
    const hasLinkedIn = (s) => !!(s && s.user && (s.user.identities || []).some((i) => i.provider === 'linkedin_oidc'));
    // Same count as the admin panel (career_admin_clients, 0024): the salary
    // range (min or max set) + every non-empty answer, out of 24 items.
    // prefsCount is also Profile details' "N of 24 answered".
    function prefsCount(p) {
      if (!p) return 0;
      let n = p.salary_min != null || p.salary_max != null ? 1 : 0;
      const a = p.answers || {};
      Object.keys(a).forEach((k) => {
        const v = a[k];
        const s = v == null ? '' : (typeof v === 'string' ? v : JSON.stringify(v));
        if (['', '[]', '{}'].indexOf(s.trim()) === -1) n++;
      });
      return Math.min(24, n);
    }
    function prefsPct(p) { return Math.min(100, Math.round(100 * prefsCount(p) / 24)); }
    function paintPrefs(pct) {
      stPct.textContent = pct + '%';
      const label = stPrefs.dataset.label.replace('{n}', pct);
      stPrefs.setAttribute('aria-label', label);
      stPrefs.title = label;
    }
    // Add LinkedIn to this login (also the "Connect LinkedIn" links under
    // Start matching and in Profile details). note: where a failure is said
    // (default: the line under the status controls).
    async function connectLinkedIn(note) {
      const box = note || stNote;
      box.hidden = true;
      let error = null;
      try { ({ error } = await Auth.linkLinkedIn()); } catch (err) { error = err; }
      // Success leaves the page for LinkedIn; anything else means linking is off.
      if (error) { box.textContent = stNote.dataset.msgLinkedinOff; box.dataset.kind = 'error'; box.hidden = false; }
    }
    stLi.addEventListener('click', () => {
      if (stLi.dataset.state === 'on') { openProfile(); return; }
      connectLinkedIn();
    });

    // ---- Start matching (7 Nov 2026, CAR-05; owner rule V-08). Since 8 Nov
    // 2026 the button sits in the title row, after the Preferences pill, and
    // #account-match is only the compact line under that row, shown when
    // there is something to say. Enabled when ANY of: a CV
    // (profiles.cv_path), LinkedIn connected (the same identity test as the
    // status button), or the main preferences filled: salary from AND to
    // (q1), target job titles (q5), languages (q20), email addresses (q22).
    // Otherwise the line says what is missing, with links. A click calls
    // request_matching(), which checks the same rule on the server and allows
    // one open request at a time (supabase/0030). The newest own
    // match_requests row decides the rest: queued / running = the "Matching
    // in progress" chip instead of the button (start time in its tooltip);
    // done = "Last matching" + the button; failed = a short note + the button
    // (so the client is never stuck). Until 0030 is run the table is missing
    // and neither the button nor the line shows.
    const mBox  = root.querySelector('#account-match');
    const mBtn  = root.querySelector('#match-start');
    const mChip = root.querySelector('#match-chip');
    const mChipTip = root.querySelector('#match-chip-tip');
    const mLine = root.querySelector('#match-line');
    const mNeed = root.querySelector('#match-need');
    const mMiss = root.querySelector('#match-missing');
    const mBtnLabel = mBtn ? mBtn.textContent : '';
    // cv / need / reqs stay null until their data is in; the row shows only
    // then, so it never flips from disabled to enabled while loading.
    const mState = { uid: null, gen: 0, li: false, cv: null, need: null, reqs: null, missing: false, busy: false, note: null };
    let PREF_LABELS = {};
    try { PREF_LABELS = JSON.parse((mBox && mBox.dataset.prefLabels) || '{}'); } catch (_e) { /* the keys show instead */ }
    const MATCH_PREFS = ['salary', 'q5', 'q20', 'q22'];
    // Same test as pref_filled() in supabase/0030: text, or a non-empty list.
    function prefFilled(v) {
      if (typeof v === 'string') return v.trim() !== '';
      if (Array.isArray(v)) return v.length > 0;
      if (v && typeof v === 'object') return Object.keys(v).length > 0;
      return typeof v === 'number';
    }
    function missingPrefs(p) {
      const a = (p && p.answers) || {};
      return MATCH_PREFS.filter((k) => (k === 'salary'
        ? !(p && p.salary_min != null && p.salary_max != null)
        : !prefFilled(a[k])));
    }
    // PostgREST's answer for a table / function that is not there yet.
    const isMissing = (err) => !!err && (['42P01', '42883', 'PGRST202', 'PGRST205'].indexOf(err.code) !== -1
      || /does not exist|schema cache|could not find/i.test(err.message || ''));
    const isOpen = (r) => !!r && (r.status === 'queued' || r.status === 'running');
    const fmtWhen = (v) => fmtDate(v) + ', ' + new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    function paintMatch() {
      if (!mBox) return;
      const s = mState;
      if (!s.uid || s.missing || s.cv == null || s.need == null || s.reqs == null) {
        // Data still loading: the button keeps its place in the row, unseen
        // (.is-pending), so the icons do not jump when it appears. Signed out
        // or no table yet: no button at all.
        const wait = !!s.uid && !s.missing;
        mBtn.hidden = !wait;
        mBtn.classList.toggle('is-pending', wait);
        mChip.hidden = true;
        mChipTip.hidden = true;
        mBox.hidden = true;
        return;
      }
      const msg = mBox.dataset;
      const latest = s.reqs[0] || null;
      const open = isOpen(latest);
      const done = s.reqs.find((r) => r.status === 'done') || null;
      const ready = s.cv || s.li || !s.need.length;
      mNeed.hidden = open || ready;
      let text = '', kind = '';
      if (s.note) { text = s.note.text; kind = s.note.kind; }
      else if (open) text = '';                      // the chip says it; its tooltip has the time
      else if (latest && latest.status === 'failed') { text = msg.msgFailed; kind = 'error'; }
      else if (done && mNeed.hidden) text = fillIn(msg.msgDone, { date: fmtDate(done.finished_at || done.created_at) });   // one line: what is missing wins
      mLine.textContent = text;
      mLine.dataset.kind = kind;
      mLine.hidden = !text;
      mMiss.textContent = mNeed.hidden ? '' : fillIn(msg.msgMissing, { list: s.need.map((k) => PREF_LABELS[k] || k).join(', ') });
      // The button gives way to the chip while a request is open; keyboard
      // focus moves with it (and back) instead of getting lost.
      const onBtn = document.activeElement === mBtn, onChip = document.activeElement === mChip;
      mBtn.classList.remove('is-pending');
      mBtn.hidden = open;
      mBtn.textContent = s.busy ? msg.msgBusy : mBtnLabel;     // "Starting…" while it asks
      mChip.hidden = !open;
      mChipTip.textContent = open ? fillIn(msg.msgStarted, { when: fmtWhen(latest.created_at) }) : '';
      if (!open) mChipTip.hidden = true;
      if (!ready || s.busy) mBtn.setAttribute('aria-disabled', 'true'); else mBtn.removeAttribute('aria-disabled');
      if (s.busy) mBtn.setAttribute('aria-busy', 'true'); else mBtn.removeAttribute('aria-busy');
      const desc = [mLine, mNeed].filter((p) => !p.hidden).map((p) => p.id).join(' ');
      if (desc) mBtn.setAttribute('aria-describedby', desc); else mBtn.removeAttribute('aria-describedby');
      mBox.hidden = mLine.hidden && mNeed.hidden;    // nothing to say: no line, no space
      if (open && onBtn) mChip.focus();
      else if (!open && onChip) mBtn.focus();
    }
    function matchSet(part) { Object.assign(mState, part); paintMatch(); }

    // The newest own requests. A failed refresh keeps what is on screen.
    function loadMatch() {
      const g = mState.gen;
      Auth.loadMatching().then(({ data, error }) => {
        if (g !== mState.gen) return;
        if (error) {
          if (isMissing(error)) mState.missing = true;
          else console.warn('account: match status failed', error.message);
          matchSet({ reqs: mState.reqs || [] });
          return;
        }
        matchSet({ missing: false, reqs: data || [], note: null });
      }, () => { if (g === mState.gen) matchSet({ reqs: mState.reqs || [] }); });
    }

    // From render(): a new person starts from "unknown"; the same person
    // (token refresh, profile update) keeps the row on screen while it reloads.
    function startMatch(session) {
      const uid = session ? session.user.id : null;
      if (uid !== mState.uid) {
        Object.assign(mState, { uid, gen: mState.gen + 1, cv: null, need: null, reqs: null, missing: false, busy: false, note: null });
      }
      mState.li = hasLinkedIn(session);
      paintMatch();
      if (uid && mBox) loadMatch();
    }

    if (mBox) {
      mBtn.addEventListener('click', async () => {
        const s = mState;
        if (mBtn.getAttribute('aria-disabled') === 'true' || !s.uid) return;
        const g = s.gen;
        const msg = mBox.dataset;
        matchSet({ busy: true, note: null });        // the button itself reads "Starting…"
        let res;
        try { res = await Auth.requestMatching(); } catch (err) { res = { error: err }; }
        if (g !== s.gen) return;
        const err = res.error;
        const text = String((err && err.message) || '');
        if (!err) {
          const row = (Array.isArray(res.data) ? res.data[0] : res.data) || {};
          s.reqs = [Object.assign({ status: 'queued', created_at: new Date().toISOString() }, row)].concat(s.reqs || []);
          matchSet({ busy: false, note: null });
        } else if (/already_open/.test(text)) {
          // Opened elsewhere (another tab): show that request once it has loaded.
          matchSet({ busy: false, note: { text: msg.msgOpen, kind: '' } });
          loadMatch();
        } else {
          const key = /not_ready/.test(text) ? 'msgNotReady'
            : /not_signed_in/.test(text) ? 'msgSignedOut'
            : isMissing(err) ? 'msgUnavailable' : 'msgError';
          matchSet({ busy: false, note: { text: msg[key], kind: 'error' } });
        }
      });
      // The links in the "what is missing" line do what the status buttons do.
      root.querySelector('#match-cv').addEventListener('click', () => (cvPath ? showCv() : cvFile.click()));
      root.querySelector('#match-li').addEventListener('click', () => connectLinkedIn());
      // Back on the tab while a request is open: has it finished meanwhile?
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && mState.reqs && isOpen(mState.reqs[0])) loadMatch();
      });
    }

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
      // Closes as before, unless My simple CV / the CV was opened on top meanwhile.
      setTimeout(() => { if (pfModal.isOpen && openModals[openModals.length - 1] === pfEl) pfModal.close(); }, 700);
    });

    // ---- LinkedIn profile modal — candidates.linkedin_audit, written by
    // sync_local.py from "NNN II LinkedIn Audit.json": the profile text as
    // it is on LinkedIn, one block per section. Button hidden until it exists.
    const liModalEl = document.getElementById('linkedin-modal');
    const liModal   = modalCtl(liModalEl);
    const liBtn     = root.querySelector('#account-linkedin-btn');
    const liBody    = document.getElementById('account-linkedin-body');
    const liScore   = document.getElementById('account-linkedin-score');
    // Button parked 20 Sep 2026 (see supabase/linkedin-mirror-contract.md); code kept to resume
    if (liBtn) liBtn.addEventListener('click', () => liModal.open('[data-close]'));

    function paintAudit(a) {
      if (!liBtn) return;
      const sections = a && Array.isArray(a.sections) ? a.sections : [];
      liBtn.hidden = !sections.length;
      if (!sections.length) return;
      liScore.textContent = [a.profile_url, a.retrieved_at ? fmtDate(a.retrieved_at) : '']
        .filter(Boolean).join(' · ');
      liBody.innerHTML = '';
      sections.forEach((sec) => {
        const el = document.createElement('section');
        el.className = 'li-audit';
        el.innerHTML = '<h3 class="li-audit__title"></h3><p class="li-audit__text"></p>';
        el.firstChild.textContent = sec.section || '';
        el.lastChild.textContent = sec.text || liModalEl.dataset.empty;
        liBody.appendChild(el);
      });
    }

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
    // The stored name is <uid>/cv-<time>.pdf; people see "cv.pdf".
    const cvShownName = () => (cvPath ? cvPath.split('/').pop().replace(/^cv-\d+\./, 'cv.') : '');

    function paintCv() {
      cvBtn.textContent = cvPath ? cvBtn.dataset.labelReview : cvBtn.dataset.labelUpload;
      paintStatus(stCv, !!cvPath);
      fillCv();                                      // Profile details, "From your CV"
      matchSet({ cv: !!cvPath });                    // a CV is enough for Start matching
    }
    async function showCv() {
      cvSay('', '');
      cvPrev.hidden = true;
      cvPrev.removeAttribute('src');
      cvName.textContent = cvShownName();
      if (!cvModal.isOpen) cvModal.open();
      const { data, error } = await Auth.cvUrl(cvPath);
      if (error || !data) { cvSay('error', cvModalEl.dataset.msgError); return; }
      cvDl.href = data.signedUrl;
      cvPrev.src = data.signedUrl + '#toolbar=0';
      cvPrev.hidden = false;
    }
    cvBtn.addEventListener('click', () => { if (cvPath) showCv(); else cvFile.click(); });
    stCv.addEventListener('click', () => { if (cvPath) showCv(); else cvFile.click(); });   // same as the side panel
    pfCvBtn.addEventListener('click', () => { if (cvPath) showCv(); else cvFile.click(); }); // and Profile details (opens on top)
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
      Object.assign(profile, { cv_path: path, cv_uploaded_at: new Date().toISOString() });   // as uploadCv saved it
      paintCv();
      await showCv();
      cvSay('ok', cvModalEl.dataset.msgUploaded);
    });
    document.getElementById('account-cv-remove').addEventListener('click', async () => {
      if (!window.confirm(cvModalEl.dataset.confirmRemove)) return;
      const { error } = await Auth.removeCv(cvPath);
      if (error) { cvSay('error', cvModalEl.dataset.msgError); return; }
      cvPath = null;
      Object.assign(profile, { cv_path: null, cv_uploaded_at: null });
      paintCv();
      cvModal.close();
    });

    // ---- My simple CV (8 Nov 2026): a one-page CV made only from what
    // Profile details shows — the names and LinkedIn link as typed there now,
    // the login email, the candidates row and the preferences. Missing pieces
    // are left out; nothing is made up. One model feeds the preview, the
    // print copy (Download PDF) and the canvas (Download JPG), so they match.
    const scvEl   = document.getElementById('scv-modal');
    const scvPage = document.getElementById('scv-page');
    const scvNote = document.getElementById('scv-status');
    const scvJpg  = document.getElementById('scv-jpg');
    const scvSay  = (kind, text) => { scvNote.textContent = text; scvNote.dataset.kind = kind; scvNote.hidden = !text; };
    let scvModel = null;
    let scvPrint = null;          // the hidden print copy, there while the dialog is open
    let scvTitle = '';            // the page title while the PDF's name stands in for it
    const scvModal = modalCtl(scvEl, () => {          // closing takes the print copy away
      document.body.classList.remove('is-printing-cv');
      if (scvPrint) { scvPrint.remove(); scvPrint = null; }
      if (scvTitle) { document.title = scvTitle; scvTitle = ''; }
    });
    const GEORGIAN = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/;
    const listOf = (t) => clean(t).split(/\s*[\n;,]\s*/).filter(Boolean);
    const safeDecode = (s) => { try { return decodeURIComponent(s); } catch (_e) { return s; } };

    function cvModel() {
      const h = scvEl.dataset;
      const typed = (k) => clean(pfForm[k].value);
      const c = cand || {};
      const a = (prefsRow && prefsRow.answers) || {};
      const targets = listOf(answerText(a.q5) || c.target_titles);   // preferences first, else what we read
      const contact = [];
      const email = clean(current && current.user && current.user.email);
      if (email) contact.push({ text: email, href: 'mailto:' + email });
      const slug = slugOf(typed('linkedin_url')) || slugOf(c.profile_url);
      if (slug) contact.push({ text: 'linkedin.com/in/' + safeDecode(slug), href: 'https://www.linkedin.com/in/' + slug + '/' });
      const sections = [];
      const role = [[h.lCompany, clean(c.company_current)], [h.lFunction, clean(c.function)], [h.lSeniority, clean(c.seniority)]]
        .filter((r) => r[1]);
      if (role.length) sections.push({ title: h.hCurrent, rows: role });
      if (targets.length) sections.push({ title: h.hTargets, text: targets.join(', ') });
      if (clean(c.locations)) sections.push({ title: h.hLocations, text: clean(c.locations) });
      const langs = answerText(a.q20) || clean(c.work_language);
      if (langs) sections.push({ title: h.hLanguages, text: langs });
      return {
        name: [typed('first_name'), typed('middle_name'), typed('last_name')].filter(Boolean).join(' '),
        headline: clean(c.headline) || targets[0] || '',
        contact,
        sections,
      };
    }

    // The CV as DOM (textContent only). links: real mailto / LinkedIn links
    // for the print copy (they stay clickable in the PDF); text in the preview.
    function buildSheet(m, links) {
      const el = (tag, cls, text) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
      };
      const sheet = el('article', 'scv');
      const head = el('header', 'scv__head');
      if (m.name) head.appendChild(el('p', 'scv__name', m.name));
      if (m.headline) head.appendChild(el('p', 'scv__headline', m.headline));
      if (m.contact.length) {
        const p = el('p', 'scv__contact');
        m.contact.forEach((c) => {
          const item = el(links ? 'a' : 'span', null, c.text);
          if (links) item.href = c.href;
          p.appendChild(item);
        });
        head.appendChild(p);
      }
      sheet.appendChild(head);
      sheet.appendChild(el('div', 'scv__rule'));
      m.sections.forEach((s) => {
        const sec = el('section', 'scv__sec');
        sec.appendChild(el('h3', 'scv__h', s.title));
        if (s.rows) {
          const dl = el('dl', 'scv__facts');
          s.rows.forEach((r) => {
            const row = el('div');
            row.appendChild(el('dt', null, r[0]));
            row.appendChild(el('dd', null, r[1]));
            dl.appendChild(row);
          });
          sec.appendChild(dl);
        } else {
          sec.appendChild(el('p', 'scv__text', s.text));
        }
        sheet.appendChild(sec);
      });
      return sheet;
    }

    // "Simple CV - Giorgi Lomidze": the JPG's file name and the PDF's suggested one.
    function cvFileName(m) {
      const name = m.name.replace(/[\\/:*?"<>|\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim();
      return scvEl.dataset.file + (name ? ' - ' + name : '');
    }

    // Opens on top of Profile details. The print copy waits, hidden, in
    // <body> while the dialog is open, so Download PDF (or Ctrl+P) prints the
    // CV alone; closing the dialog removes it again (see scvModal above).
    function openSimpleCv() {
      scvModel = cvModel();
      scvPage.textContent = '';
      scvPage.appendChild(buildSheet(scvModel, false));
      if (scvPrint) scvPrint.remove();
      scvPrint = document.createElement('div');
      scvPrint.className = 'scv-print';
      scvPrint.appendChild(buildSheet(scvModel, true));
      document.body.appendChild(scvPrint);
      document.body.classList.add('is-printing-cv');
      scvSay('', scvModel.name ? '' : scvEl.dataset.msgNoName);
      scvModal.open('#scv-pdf');
    }
    document.getElementById('pf-simple-cv').addEventListener('click', openSimpleCv);

    // Download PDF: the browser's own print window ("Save as PDF"), which
    // suggests the page title as the file name.
    document.getElementById('scv-pdf').addEventListener('click', () => {
      if (!scvModel) return;
      if (!scvTitle) scvTitle = document.title;
      document.title = cvFileName(scvModel);
      const back = () => {
        window.removeEventListener('afterprint', back);
        if (scvTitle) { document.title = scvTitle; scvTitle = ''; }
      };
      window.addEventListener('afterprint', back);
      window.print();
    });

    // Download JPG: the sheet drawn again on a canvas, A4 at 150 dpi
    // (1240 × 1754, white), with the sizes of .scv in styles.css section 26:
    // base 10 pt, margins 18 mm, everything else in em of that base.
    const CV_W = 1240, CV_H = 1754;
    const CV_B = 10 * 150 / 72;                    // 10 pt at 150 dpi, in px
    const CV_M = 18 * CV_W / 210;                  // 18 mm
    const CV_INK = '#14213d', CV_SOFT = '#4a5568', CV_ACCENT = '#f26b1d';   // --ink, --ink-soft, --accent
    const CV_SANS = '"General Sans", "Noto Sans Georgian", Arial, sans-serif';
    const CV_SERIF = '"Fraunces", "Noto Sans Georgian", Georgia, serif';

    // The fonts the drawing uses, loaded first (Georgian letters come from
    // Noto Sans Georgian). Never waits more than 4 s; then the fallbacks draw.
    function cvFonts(m) {
      const fonts = document.fonts;
      if (!fonts || !fonts.load) return Promise.resolve();
      const text = [m.name, m.headline].concat(
        m.contact.map((c) => c.text),
        m.sections.map((s) => s.title + ' ' + (s.rows ? s.rows.map((r) => r.join(' ')).join(' ') : s.text))
      ).join(' ');
      const jobs = ['500 54px "Fraunces"', '400 22px "General Sans"', '500 22px "General Sans"'].map((f) => fonts.load(f, text));
      if (GEORGIAN.test(text)) jobs.push(fonts.load('400 22px "Noto Sans Georgian"', text), fonts.load('500 22px "Noto Sans Georgian"', text));
      return Promise.race([Promise.all(jobs).catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
    }

    // Lines that fit maxW; a word longer than a line (a long email) is cut.
    function wrapLines(ctx, text, maxW) {
      const out = [];
      String(text).split('\n').forEach((para) => {
        let line = '';
        para.split(/\s+/).filter(Boolean).forEach((word) => {
          let w = word;
          while (ctx.measureText(w).width > maxW) {
            const ch = Array.from(w);
            let n = Math.max(1, ch.length - 1);
            while (n > 1 && ctx.measureText(ch.slice(0, n).join('')).width > maxW) n--;
            if (line) { out.push(line); line = ''; }
            out.push(ch.slice(0, n).join(''));
            w = ch.slice(n).join('');
          }
          if (!w) return;
          const test = line ? line + ' ' + w : w;
          if (line && ctx.measureText(test).width > maxW) { out.push(line); line = w; } else line = test;
        });
        if (line) out.push(line);
      });
      return out;
    }

    function cvJpeg(m) {
      return cvFonts(m).then(() => {
        const canvas = document.createElement('canvas');
        canvas.width = CV_W;
        canvas.height = CV_H;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, CV_W, CV_H);
        ctx.textBaseline = 'middle';
        const B = CV_B, X = CV_M, W = CV_W - 2 * CV_M, BOTTOM = CV_H - CV_M;
        const track = (px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; };
        // Wrapped text from y down (nothing below the bottom margin); returns the y under it.
        function put(text, y, o) {
          ctx.font = o.weight + ' ' + o.size.toFixed(2) + 'px ' + o.family;
          ctx.fillStyle = o.color;
          track(o.spacing || 0);
          const lh = o.size * o.lh;
          wrapLines(ctx, o.caps ? text.toUpperCase() : text, o.w).forEach((ln) => {
            if (y + lh <= BOTTOM) ctx.fillText(ln, o.x, y + lh / 2);
            y += lh;
          });
          track(0);
          return y;
        }
        let y = X;
        let first = true;
        if (m.name) {
          y = put(m.name, y, { size: 2.6 * B, weight: 500, family: CV_SERIF, color: CV_INK, lh: 1.15, x: X, w: W });
          first = false;
        }
        if (m.headline) {
          if (!first) y += 0.35 * 1.3 * B;
          y = put(m.headline, y, { size: 1.3 * B, weight: 500, family: CV_SANS, color: CV_SOFT, lh: 1.35, x: X, w: W });
          first = false;
        }
        if (m.contact.length) {
          if (!first) y += 0.8 * B;
          ctx.font = '400 ' + B.toFixed(2) + 'px ' + CV_SANS;
          ctx.fillStyle = CV_INK;
          const lh = 1.5 * B;
          let x = X;
          m.contact.forEach((c) => {
            const w = Math.min(ctx.measureText(c.text).width, W);
            if (x > X && x + w > X + W) { x = X; y += lh; }
            ctx.fillText(c.text, x, y + lh / 2, X + W - x);   // a too-long item is squeezed, not cut off
            x += w + 1.6 * B;
          });
          y += lh;
        }
        y += 1.3 * B;                                         // .scv__rule: a short orange bar
        ctx.fillStyle = CV_ACCENT;
        ctx.fillRect(X, y, 3.4 * B, 0.25 * B);
        y += 0.25 * B;
        m.sections.forEach((s) => {
          const hs = 0.85 * B, ts = 1.05 * B;
          y += 1.9 * B;
          y = put(s.title, y, { size: hs, weight: 500, family: CV_SANS, color: CV_SOFT, lh: 1.4, x: X, w: W, caps: true, spacing: 0.12 * hs });
          y += 0.6 * hs;
          if (s.rows) {
            const lab = 7.5 * ts, gap = ts;
            s.rows.forEach((r, i) => {
              if (i) y += 0.3 * ts;
              const y1 = put(r[0], y, { size: ts, weight: 400, family: CV_SANS, color: CV_SOFT, lh: 1.5, x: X, w: lab });
              const y2 = put(r[1], y, { size: ts, weight: 400, family: CV_SANS, color: CV_INK, lh: 1.5, x: X + lab + gap, w: W - lab - gap });
              y = Math.max(y1, y2);
            });
          } else {
            y = put(s.text, y, { size: ts, weight: 400, family: CV_SANS, color: CV_INK, lh: 1.5, x: X, w: W });
          }
        });
        return new Promise((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no picture'))), 'image/jpeg', 0.92);
        });
      });
    }

    scvJpg.addEventListener('click', async () => {
      if (!scvModel || scvJpg.getAttribute('aria-busy') === 'true') return;
      scvJpg.setAttribute('aria-busy', 'true');
      scvSay('busy', scvEl.dataset.msgBusy);
      try {
        const blob = await cvJpeg(scvModel);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = cvFileName(scvModel) + '.jpg';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        scvSay('', scvModel.name ? '' : scvEl.dataset.msgNoName);
      } catch (err) {
        console.warn('simple CV: picture failed', err);
        scvSay('error', scvEl.dataset.msgError);
      }
      scvJpg.removeAttribute('aria-busy');
    });

    // Download vacancies — the client's shortlist workbook (.xlsx),
    // uploaded by sync_local.py. Signed URL fetched on click (10-min life).
    const wb = root.querySelector('#account-workbook');
    let workbookPath = null;
    wb.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!workbookPath) return;
      const { data, error } = await Auth.workbookUrl(workbookPath);
      if (error || !data) { window.alert(wb.dataset.msgError); return; }
      window.location.href = data.signedUrl;
    });

    // Delete my account (5 Nov 2026): the side-panel button is the only way
    // in. Hover or keyboard focus shows #delete-tip (also its
    // aria-describedby); a click opens #delete-pop: next to the button from
    // 1024px, a small centred dialog below that. modalCtl gives Esc / Cancel /
    // outside click, the trapTab focus trap and focus back on the button.
    // The window is the confirmation (owner: no browser confirm()); its
    // Delete button deletes at once, with the old busy / error messages.
    const delOpen  = root.querySelector('#account-delete-open');
    const delTip   = root.querySelector('#delete-tip');
    const delEl    = document.getElementById('delete-pop');
    const delPanel = delEl.querySelector('.delete-pop__panel');
    const delPop   = modalCtl(delEl);
    const del      = document.getElementById('account-delete');
    const delNote  = document.getElementById('delete-status');
    const wideMq   = window.matchMedia('(min-width: 1024px)');
    const EDGE = 8;                      // px kept free at the viewport edges

    // Tooltip: fixed, under the link (above it if there is no room), so the
    // phone chip row's horizontal scroll never clips it. Hides on scroll.
    let tipTimer = 0;
    function showTip() {
      clearTimeout(tipTimer);
      if (delPop.isOpen) return;
      delTip.hidden = false;
      const r = delOpen.getBoundingClientRect();
      const w = delTip.offsetWidth, h = delTip.offsetHeight;
      let top = r.bottom + EDGE;
      if (top + h > window.innerHeight - EDGE) top = Math.max(EDGE, r.top - EDGE - h);
      delTip.style.left = Math.max(EDGE, Math.min(r.left, window.innerWidth - w - EDGE)) + 'px';
      delTip.style.top = top + 'px';
    }
    function hideTip(later) {
      clearTimeout(tipTimer);
      if (later) tipTimer = setTimeout(() => { delTip.hidden = true; }, 150);
      else delTip.hidden = true;
    }
    const focusVisible = (el) => { try { return el.matches(':focus-visible'); } catch (_e) { return true; } };
    if (window.matchMedia('(hover: hover)').matches) {
      delOpen.addEventListener('mouseenter', showTip);
      delOpen.addEventListener('mouseleave', () => hideTip(true));
      delTip.addEventListener('mouseenter', showTip);         // the pointer may move onto the tip
      delTip.addEventListener('mouseleave', () => hideTip(true));
    }
    delOpen.addEventListener('focus', () => { if (focusVisible(delOpen)) showTip(); });
    delOpen.addEventListener('blur', () => hideTip(false));
    delOpen.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(false); });
    window.addEventListener('scroll', () => { if (!delTip.hidden) hideTip(false); }, { passive: true, capture: true });

    // >=1024px: the panel sits right of the button, top-aligned, kept on
    // screen and above the cookie banner while that is open (it sits on top).
    function placePop() {
      const wide = wideMq.matches;
      delEl.classList.toggle('is-anchored', wide);
      if (!wide) { delPanel.style.left = ''; delPanel.style.top = ''; return; }
      const r = delOpen.getBoundingClientRect();
      const w = delPanel.offsetWidth, h = delPanel.offsetHeight;
      const banner = document.getElementById('cookie-banner');
      const floor = window.innerHeight - (banner && !banner.hidden ? banner.offsetHeight : 0);
      delPanel.style.left = Math.max(EDGE, Math.min(r.right + 2 * EDGE, window.innerWidth - w - 2 * EDGE)) + 'px';
      delPanel.style.top = Math.max(2 * EDGE, Math.min(r.top, floor - h - 2 * EDGE)) + 'px';
    }
    delOpen.addEventListener('click', () => {
      if (!del.disabled) { delNote.hidden = true; delNote.textContent = ''; }   // fresh window unless a deletion is running
      delOpen.focus({ preventScroll: true });   // Safari does not focus a clicked button; modalCtl returns focus here
      hideTip(false);                           // after the focus, which may have shown it
      delPop.open('.delete-pop__cancel');
      placePop();
    });
    window.addEventListener('resize', () => { if (delPop.isOpen) placePop(); });

    del.addEventListener('click', async () => {
      if (del.disabled) return;
      delNote.textContent = del.dataset.msgBusy; delNote.dataset.kind = 'busy'; delNote.hidden = false;
      del.disabled = true;
      const { error } = await Auth.deleteAccount();
      if (error) {
        delNote.textContent = del.dataset.msgError; delNote.dataset.kind = 'error';
        del.disabled = false;
        return;
      }
      try { await Auth.signOut(); } catch (_) { /* user is already gone */ }
      del.disabled = false; delNote.hidden = true;
      if (delPop.isOpen) delPop.close();
      const gone = root.querySelector('#account-deleted');
      gone.hidden = false;
      render(null);
      gone.setAttribute('tabindex', '-1');      // the link is gone with the signed-in view; land on the notice
      gone.focus();
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

    // ---- Tooltips in the title row (8 Nov 2026): the login icon ("Signed in
    // with … as …", also its name) and the "Matching in progress" chip (when
    // it started, also its description). Same look and placement as
    // #delete-tip (.account-tip, fixed, kept on screen): hover or keyboard
    // focus shows them; leaving, Esc, blur or scrolling hides them. A click /
    // tap on the chip shows its tip too (phones have no hover).
    function hoverTip(anchor, tip) {
      let timer = 0;
      function show() {
        clearTimeout(timer);
        if (!tip.textContent) return;
        tip.hidden = false;
        tip.style.left = '0px';                    // measure at full width
        tip.style.top = '0px';
        const r = anchor.getBoundingClientRect();
        const w = tip.offsetWidth, h = tip.offsetHeight;
        let top = r.bottom + EDGE;
        if (top + h > window.innerHeight - EDGE) top = Math.max(EDGE, r.top - EDGE - h);
        tip.style.left = Math.max(EDGE, Math.min(r.left + (r.width - w) / 2, window.innerWidth - w - EDGE)) + 'px';
        tip.style.top = top + 'px';
      }
      function hide(later) {
        clearTimeout(timer);
        if (later) timer = setTimeout(() => { tip.hidden = true; }, 150);
        else tip.hidden = true;
      }
      if (window.matchMedia('(hover: hover)').matches) {
        anchor.addEventListener('mouseenter', show);
        anchor.addEventListener('mouseleave', () => hide(true));
        tip.addEventListener('mouseenter', show);   // the pointer may move onto the tip
        tip.addEventListener('mouseleave', () => hide(true));
      }
      anchor.addEventListener('focus', () => { if (focusVisible(anchor)) show(); });
      anchor.addEventListener('blur', () => hide(false));
      anchor.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(false); });
      window.addEventListener('scroll', () => { if (!tip.hidden) hide(false); }, { passive: true, capture: true });
      return { show, hide };
    }
    if (stLogin && stLoginTip) hoverTip(stLogin, stLoginTip);
    if (mChip && mChipTip) {
      const chipTip = hoverTip(mChip, mChipTip);
      mChip.addEventListener('click', () => chipTip.show());
    }

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

  /* ---------------------------------------------------------------------
     Enquiry events (measure-enquiries spec). Sent through the existing gtag
     only when the visitor has accepted cookies; nothing fires when declined
     or undecided. No GA4 ID is configured yet, so until one is added these
     reach only the Google Ads tag.
     --------------------------------------------------------------------- */
  // Google Ads conversions. Fired from track() below, so they are consent-gated too.
  // "Lead" conversion: a sent contact form (Google booking pages post no booked event).
  const ADS_LEAD_CONVERSION = 'AW-18182297582/4NM8CKTh37EcEO6v_91D';
  // Purchase conversion: EMPTY on purpose. When the owner creates a "Purchase"
  // conversion action in Google Ads, put its full send_to here
  // (e.g. 'AW-18182297582/AbCdEf...') and every 'purchase' event (payment-result
  // page) will also send it, with value, currency GEL and transaction_id.
  const ADS_PURCHASE_LABEL = '';

  function track(name, params) {
    if (typeof gtag !== 'function') return;
    let consent = null;
    try { consent = localStorage.getItem('phantasma_cookie_consent'); } catch (e) { /* storage blocked */ }
    if (consent !== 'accepted') return;
    const p = params || {};
    gtag('event', name, p);
    if (name === 'contact_submitted') {
      gtag('event', 'conversion', { send_to: ADS_LEAD_CONVERSION });
    }
    if (name === 'purchase' && ADS_PURCHASE_LABEL) {
      gtag('event', 'conversion', {
        send_to: ADS_PURCHASE_LABEL,
        value: p.value,
        currency: 'GEL',
        transaction_id: p.transaction_id,
      });
    }
  }

  /* ---------------------------------------------------------------------
     Short contact form (index.html, after the impact tiles). Posts to the
     Edge Function contact-submit (no login; it stores the row with the
     service role and emails the owner). Honeypot field "website" is sent
     as is; the server drops filled ones silently.
     --------------------------------------------------------------------- */
  const CONTACT_ENDPOINT = 'https://muumpjtpjnoxxdkhqtik.supabase.co/functions/v1/contact-submit';

  function bootContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const status = document.getElementById('contact-form-status');
    const btn = form.querySelector('button[type="submit"]');
    let sending = false;

    function say(kind) {
      if (!status) return;
      status.textContent = status.dataset[kind] || '';
      status.dataset.kind = kind === 'ok' || kind === 'busy' ? kind : 'error';
      status.hidden = false;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (sending) return;
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      const message = form.elements.message.value.trim();
      if (!name || !message || !form.elements.email.checkValidity() || !email) {
        say('invalid');
        return;
      }
      sending = true;
      if (btn) btn.disabled = true;
      say('busy');
      fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        // Same apikey header supabase-js sends; the function itself needs no login.
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
        body: JSON.stringify({
          name,
          email,
          message,
          page: location.pathname,
          website: form.elements.website ? form.elements.website.value : '',
        }),
      })
        .then((r) => r.json().catch(() => ({})).then((data) => ({ ok: r.ok && data.ok === true })))
        .then(({ ok }) => {
          if (!ok) throw new Error('send failed');
          say('ok');
          form.reset();
          track('contact_submitted');
        })
        .catch(() => say('error'))
        .finally(() => {
          sending = false;
          if (btn) btn.disabled = false;
        });
    });
  }

  function bootEventTracking() {
    document.addEventListener('click', (e) => {
      if (!e.target.closest) return;
      const tierBtn = e.target.closest('[data-tier]');
      if (tierBtn) {
        track('pay_now_click', { tier: tierBtn.dataset.tier });
        return;
      }
      const mail = e.target.closest('a[href^="mailto:"]');
      if (mail) {
        track('contact_email_click');
        return;
      }
      // Book a call: any link to the contact section except the plain nav "Contact" link.
      // [data-open-booking] / #booking-placeholder are tracked by bootBooking when the dialog opens.
      const book = e.target.closest('a[href$="#contact"]');
      if (book && !book.closest('.site-nav') && !book.closest('[data-open-booking]')) {
        track('book_call_click');
      }
    });
  }

  // Google Workspace appointment schedule (consult@solvephantasma.com), embed mode.
  // Public booking-page URL, not a secret.
  const BOOKING_URL = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ0ki0aEhxq8-sjpLOxYytOX1M6SvJYnAomC4oTGmE5Wxq1BSowyQQ9i2R52IIczfYpB18T4IREo?gv=true';

  // Booking dialog (2 Nov 2026, replaced the inline iframe, which showed an
  // inner scrollbar). Any [data-open-booking] control, or the landing page's
  // #booking-placeholder, opens a viewport-sized dialog with the Google
  // calendar inside. The dialog is built on first open, so nothing from
  // Google loads before the click. Same conventions as the auth modal:
  // close button, Esc, backdrop, trapTab, focus restored, body.is-locked.
  // Google does not post a "booked" event to the host page, so there is
  // no booking conversion; only the open (book_call_click) is tracked.
  function bootBooking() {
    const placeholder = document.getElementById('booking-placeholder');
    const triggers = Array.from(document.querySelectorAll('[data-open-booking]'));
    if (placeholder) triggers.push(placeholder);
    if (triggers.length === 0) return;

    let modal = null;
    let panel = null;
    let lastFocus = null;

    function build() {
      modal = document.createElement('div');
      modal.className = 'booking-modal';
      modal.id = 'booking-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'booking-modal-title');
      modal.hidden = true;
      modal.innerHTML =
        '<div class="booking-modal__backdrop" data-close></div>' +
        '<div class="booking-modal__panel">' +
          '<div class="booking-modal__head">' +
            '<h2 class="booking-modal__title" id="booking-modal-title">Book a 30-minute call</h2>' +
            '<a class="link-quiet booking-modal__newtab" target="_blank" rel="noopener">Open booking page in a new tab</a>' +
            '<button class="booking-modal__close" type="button" data-close aria-label="Close">✕</button>' +
          '</div>' +
        '</div>';
      panel = modal.querySelector('.booking-modal__panel');
      modal.querySelector('.booking-modal__newtab').href = BOOKING_URL;

      const frame = document.createElement('iframe');
      frame.className = 'booking-modal__frame';
      frame.title = 'Book a 30-minute call (Google Calendar)';
      frame.src = BOOKING_URL;
      frame.setAttribute('frameborder', '0');
      panel.appendChild(frame);

      modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
      document.body.appendChild(modal);
    }

    function open(trigger) {
      track('book_call_click');
      // Restore focus to the control that opened the dialog (a mouse click
      // does not focus buttons in every browser, e.g. Safari).
      lastFocus = trigger || document.activeElement;
      if (!modal) build();
      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add('is-open'));
      document.body.classList.add('is-locked');
      modal.querySelector('.booking-modal__close').focus();
    }

    function close() {
      if (!modal || modal.hidden) return;
      modal.classList.remove('is-open');
      modal.hidden = true;
      document.body.classList.remove('is-locked');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    triggers.forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        open(el);
      });
    });
    if (placeholder) {
      placeholder.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open(placeholder);
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (!modal || modal.hidden) return;
      if (e.key === 'Escape') close();
      else trapTab(panel, e);
    });
    // Tabbing out of the end of the cross-origin iframe skips our keydown
    // handler; pull focus back into the dialog if it lands behind it.
    document.addEventListener('focusin', (e) => {
      if (modal && !modal.hidden && !modal.contains(e.target)) {
        modal.querySelector('.booking-modal__close').focus();
      }
    });
  }

  /* ---------------------------------------------------------------------
     Image zoom overlay
     --------------------------------------------------------------------- */
  function bootImageZoom() {
    const overlay = document.createElement('div');
    overlay.className = 'img-zoom-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Full image');
    overlay.innerHTML = `
      <button class="img-zoom-overlay__close" aria-label="Close full image">×</button>
      <img class="img-zoom-overlay__img" src="" alt="" />
    `;
    document.body.appendChild(overlay);

    const overlayImg = overlay.querySelector('.img-zoom-overlay__img');
    const closeBtn   = overlay.querySelector('.img-zoom-overlay__close');
    let opener = null;   // the image button that opened the overlay

    function closeZoom() {
      overlay.classList.remove('is-open');
      if (opener && opener.focus) opener.focus();
      opener = null;
    }

    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.slide-built__image-btn');
      if (btn) {
        opener = btn;
        overlayImg.src = btn.dataset.src;
        overlayImg.alt = btn.dataset.alt;
        overlay.classList.add('is-open');
        closeBtn.focus();
        return;
      }
      if (overlay.classList.contains('is-open') &&
          (e.target === overlay || e.target.closest('.img-zoom-overlay__close'))) {
        closeZoom();
      }
    });

    overlay.addEventListener('keydown', function (e) {
      // Esc closes only the zoom, not the lightbox underneath.
      if (e.key === 'Escape') { e.stopPropagation(); closeZoom(); }
      // Close is the only control: keep Tab on it, out of the lightbox behind.
      if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); closeBtn.focus(); }
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
        // No conversion here: accepting cookies is not a lead. The Ads lead
        // conversion fires only from track('contact_submitted') (CLAUDE.md §6).
      }
    });

    document.getElementById('cookie-decline').addEventListener('click', () => {
      localStorage.setItem('phantasma_cookie_consent', 'declined');
      banner.hidden = true;
    });
  }

  // Account side panel: active-section highlight, and proxy buttons that
  // reuse the existing stat tiles (no logic duplicated). The nav sits inside
  // #account-signed-in, so it is hidden with it when signed out.
  function bootAccountNav() {
    const el = document.getElementById('account-nav');
    if (!el) return;

    const links = Array.from(el.querySelectorAll('[data-nav-target]'));
    const setCurrent = (item) => {
      links.forEach((l) => l.removeAttribute('aria-current'));
      if (item) item.setAttribute('aria-current', 'true');
    };
    const goTo = (id) => {
      const t = document.getElementById(id);
      if (!t) return;
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      t.focus({ preventScroll: true });
    };

    links.forEach((l) => l.addEventListener('click', (e) => {
      e.preventDefault();
      goTo(l.dataset.navTarget);
      setCurrent(l);
    }));

    // "Vacancy lists" opens the existing "processed" tile's table.
    el.querySelectorAll('[data-nav-panel]').forEach((b) => b.addEventListener('click', () => {
      const tile = document.querySelector('.stat[data-panel="' + b.dataset.navPanel + '"]');
      if (!tile) return;
      if (tile.getAttribute('aria-expanded') !== 'true') tile.click();
      const title = document.getElementById('stat-panel-title');
      if (title && !document.getElementById('stat-panel').hidden) {
        title.setAttribute('tabindex', '-1');
        title.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
        title.focus({ preventScroll: true });
      }
    }));

    // Highlight follows scroll: last section whose top has passed 40% of the viewport.
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        let cur = links[0];
        links.forEach((l) => {
          const t = document.getElementById(l.dataset.navTarget);
          if (t && t.getBoundingClientRect().top <= window.innerHeight * 0.4) cur = l;
        });
        setCurrent(cur);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // payment-result.html — where Flitt sends the customer back. The URL is
  // never trusted: order_id is only a lookup key, and the status is read from
  // our own flitt_orders row (RLS: own rows only). The server callback can
  // arrive after the redirect, so poll every 2 s for about 30 s.
  function bootPaymentResult() {
    const root = document.getElementById('payment-result');
    if (!root) return;
    const h1      = root.querySelector('#payment-result-h');
    const body    = root.querySelector('.payment-result__body');
    const text    = root.querySelector('#payment-result-text');
    const actions = root.querySelector('#payment-result-actions');
    const ORDER_KEY = 'phantasma_flitt_order';
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // order_id: URL first (kept in sessionStorage across a login round-trip), else the stored one
    const fromUrl = new URLSearchParams(location.search).get('order_id');
    if (fromUrl && UUID.test(fromUrl)) sessionStorage.setItem(ORDER_KEY, fromUrl);
    const stored = sessionStorage.getItem(ORDER_KEY);
    const orderId = stored && UUID.test(stored) ? stored : null;

    const link = (href, label, primary) => {
      const a = document.createElement('a');
      a.className = 'btn' + (primary ? ' btn-primary' : '');
      a.href = href;
      a.textContent = label;
      return a;
    };
    const button = (label, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-primary';
      b.textContent = label;
      b.addEventListener('click', onClick);
      return b;
    };

    function show(state, title, msg, btns, focus) {
      body.dataset.state = state;
      h1.textContent = title;
      text.textContent = msg;
      actions.replaceChildren(...btns);
      if (focus) h1.focus();
    }

    const VIEWS = {
      paid: () => show('paid', 'Payment received',
        'You can start working with the interface and the support team now.',
        [link('./account.html', 'Go to my account', true), link('./projects.html', 'Back to the plans', false)], true),
      declined: () => show('failed', 'Payment not completed',
        'The bank did not accept this payment, so you have not been charged. You can try again, or use another card.',
        [link('./projects.html', 'Try again', true)], true),
      failed: () => show('failed', 'Payment not completed',
        'Something went wrong with this payment, so it was not completed. You can try again.',
        [link('./projects.html', 'Try again', true)], true),
      expired: () => show('failed', 'Payment expired',
        'This payment was not finished in time, so you have not been charged. You can start again.',
        [link('./projects.html', 'Start again', true)], true),
      reversed: () => show('failed', 'Payment refunded',
        'This payment has been refunded. If that is not what you expected, write to consult@solvephantasma.com.',
        [link('./projects.html', 'Back to the plans', true)], true),
      unknown: () => show('unknown', 'We could not confirm your payment',
        'We have no confirmation yet. If you were charged, it will appear in your account shortly. If it does not, write to consult@solvephantasma.com and mention the time of the payment.',
        [link('./account.html', 'Go to my account', true), link('./projects.html', 'Back to the plans', false)], true),
      signedOut: () => show('unknown', 'Please log in to see your payment',
        'We show the result of a payment only to the account that made it. Log in and we will check it for you.',
        [button('Log in', () => { const a = document.querySelector('.js-auth'); if (a) a.click(); })], true),
    };

    let polling = false;
    function poll() {
      if (polling) return;
      polling = true;
      if (!orderId) { VIEWS.unknown(); return; }
      const started = Date.now();
      const tick = async () => {
        const { data, error } = await Auth.db().from('flitt_orders').select('status, amount_minor, currency, plan_code').eq('order_id', orderId).maybeSingle();
        const status = !error && data ? data.status : null;
        if (status === 'approved') {
          // GA4 purchase, once per order (consent-gated inside track()).
          let seen = null;
          try { seen = sessionStorage.getItem('phantasma_ga_purchase'); } catch (e) { /* storage blocked */ }
          if (seen !== orderId) {
            track('purchase', { transaction_id: orderId, value: (data.amount_minor || 0) / 100, currency: data.currency || 'GEL', items: [{ item_id: data.plan_code }] });
            try { sessionStorage.setItem('phantasma_ga_purchase', orderId); } catch (e) { /* storage blocked */ }
          }
          return VIEWS.paid();
        }
        if (VIEWS[status] && status !== 'created' && status !== 'processing') return VIEWS[status]();
        if (Date.now() - started >= 30000) return VIEWS.unknown();
        setTimeout(tick, 2000);
      };
      tick();
    }

    if (!window.supabase) { VIEWS.unknown(); return; }
    document.addEventListener('phantasma:auth', (e) => {
      if (e.detail.session) poll();
      else if (!polling) VIEWS.signedOut();
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
    bootPricingCards();
    Auth.boot();
    bootAuthModal();
    bootAccountPage();
    bootAccountNav();
    bootPreferencesPage();
    bootPaymentResult();
    bootBooking();
    bootContactForm();
    bootEventTracking();
    bootImageZoom();
  }

  // Read-only hook for career.js (admin panel + client chat; loaded after
  // this file on account, preferences and admin pages): the one Supabase
  // client Auth already holds (null without supabase-js) and the current
  // session. Nothing else from this IIFE is exposed.
  window.PhantasmaAuth = {
    db: () => Auth.db(),
    session: () => Auth.getSession(),
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
