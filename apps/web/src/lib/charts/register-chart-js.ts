import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
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
    Filler,
    BarController,
    BarElement,
  );
}

export { Chart };
