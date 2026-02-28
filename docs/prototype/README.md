# Badgers Finance Prototype

This is a code bundle for Badgers Finance Prototype. The original project is available at https://www.figma.com/design/lts47RenSB6zV99RbIrJOy/Badgers-Finance-Prototype.

## Relationship to MVP

This prototype is a Figma-derived UI reference for the Badgers Investments MVP. The **Dashboard**, **Assets**, **Ledger**, **Performance**, and **Recommendations** screens align with MVP: use them as the basis for the Svelte app (wealth overview, holdings table, transaction list with filters, TWR and portfolio value charts, and rule/AI recommendation list with manual run). The MVP scope is **stocks (and ETFs) only**; the prototype’s mock data includes additional asset classes (bonds, crypto, real estate, etc.) for illustration—implement only stock/ETF assets and flows. The **Explore** page (investment opportunities, technical analysis, AI chat) goes beyond MVP: it is out of scope for the first release; either omit it or reduce it to a minimal entry point (e.g. a “Run recommendation” action). The prototype does not include authentication (username/password), asset detail with lot-level drill-down, settings for the OpenAI API key, or an audit/activity log—these must be added in the real application.

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.
