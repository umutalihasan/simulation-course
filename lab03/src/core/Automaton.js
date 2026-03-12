import { applyBaseRules }    from '../rules/BaseRules.js';
import { applyWindRule }     from '../rules/WindRule.js';
import { applyHumidityRule, applyRainEffect } from '../rules/HumidityRule.js';
import { applyLightningRule }from '../rules/LightningRule.js';
import { applyFirebreakRule }from '../rules/FirebreakRule.js';

export class Automaton {
  constructor(grid) {
    this.grid = grid;
    this.generation = 0;
    this.params = {
      spreadProb:      0.8,
      igniteProb:      0.0005,
      growProb:        0.005,
      windDir:         'N',
      windStrength:    0.4,
      humidity:        0.3,
      treeDensity:     0.65,
      enableWind:      true,
      enableHumidity:  true,
      enableLightning: true,
      enableFirebreak: true,
      enableGrowth:    true,
      _lastLightning:  null,
    };
  }

  step() {
    const { grid, params } = this;

    grid.copyToNext();

    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const cur = grid.get(x, y);

        // Kural 4: Firebreak öncelikli
        if (params.enableFirebreak) {
          const fb = applyFirebreakRule(x, y, cur, grid);
          if (fb !== null) { grid.setNext(x, y, fb); continue; }
        }

        // Kural 1: Temel
        let next = applyBaseRules(x, y, cur, grid, params);

        // Kural 2: Rüzgar
        if (params.enableWind) {
          const wr = applyWindRule(x, y, cur, grid, params);
          if (wr !== null) next = wr;
        }

        // Kural 3: Nem
        if (params.enableHumidity) {
          const hr = applyHumidityRule(x, y, next, params);
          if (hr !== null) next = hr;
        }

        grid.setNext(x, y, next);
      }
    }

    grid.swap();

    // Kural 5 & Nem — swap'tan SONRA cells'e doğrudan yazılır.
    // swap() öncesi yazılsaydı next tarafından ezilirdi.
    if (params.enableHumidity)  applyRainEffect(grid, params);
    if (params.enableLightning) applyLightningRule(grid, params);

    this.generation++;
  }

  reset() {
    this.generation = 0;
    this.grid.fill(this.params.treeDensity);
  }
}