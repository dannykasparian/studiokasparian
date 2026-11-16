import { createRoot } from 'react-dom/client';
import Scan from './Scan.jsx';

// Si aggancia al segnaposto della pagina. Se manca (o WebGL non parte), resta la foto.
const mount = document.querySelector('[data-scan3d-mount]');
if (mount) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  createRoot(mount).render(<Scan reduced={reduced} />);
}
