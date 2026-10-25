# Red Room Buy Box

USA dashboard of Airbnb red rooms (BDSM / kink / adult playroom listings), 1BR and 2BR only. It shows where they are and how their revenue compares with the other homes of the same size in their market. It is a static site with no build step, on the same Leaflet and STR Search template as the market sites.

- **Map:** every red room. Markets are filters; selecting one zooms to its region.
- **Revenue position:** each market's 1BR and 2BR homes on one revenue axis, with the red rooms highlighted.
- **Table:** estimated revenue; percentile among same-size homes and among all homes; × the market's median; the gap to the market's top 1BR and top 2BR; ADR; occupancy.

## Data

`js/data.js` is generated; don't edit it by hand. It is built by `scripts/build_dashboard_data.py` in the local project folder (`7AugBuyBox/Redroom_Buybox`) from:
- each market's Market Eval workbook (Cleaned_Data, entire homes);
- `config/redrooms.csv`, the reviewed red room ledger: confirmed by the team, or new finds from the keyword and photo scans.

How the numbers are defined:
- **Est. revenue:** the workbook's Revenue Potential.
- **Percentiles:** the share of the market's homes (same bedroom count, or all homes) earning the same or less.
- **Median and max:** the market's other homes of that size, with red rooms excluded.
