import {
  ArcElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Tooltip,
} from 'chart.js';

let didRegister: boolean = false;

export function registerChartJs(): void {
  if (didRegister) {
    return;
  }
  didRegister = true;
  Chart.register(
    ArcElement,
    PieController,
    LineController,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Legend,
    Tooltip,
  );
}

export { Chart };
