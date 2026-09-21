import { App } from './App';
import { bootstrapTheme } from '../../shared/theme';
import { createRoot } from 'react-dom/client';
import '../../shared/page.css';
import './epicker.css';

bootstrapTheme();

const container = document.getElementById('root');
if ( container !== null ) {
    createRoot(container).render(<App />);
}
