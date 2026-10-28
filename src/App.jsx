import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import TopBar from './components/TopBar.jsx';
import { restaurants } from './data/index.js';

// Не на каждой посадке нужны: страница ресторана/чекаута, отслеживание заказа, «Мои заказы»
// и особенно AdminBoard (тянет за собой Firebase Auth и вообще не нужен обычным клиентам) —
// выносим их в отдельные чанки, чтобы главная страница грузилась без этого веса.
const RestaurantMenu = lazy(() => import('./pages/RestaurantMenu.jsx'));
const OrderTracking = lazy(() => import('./pages/OrderTracking.jsx'));
const MyOrders = lazy(() => import('./pages/MyOrders.jsx'));
const AdminBoard = lazy(() => import('./pages/AdminBoard.jsx'));

function Shell({ children }) {
  return (
    <div className="shell">
      <TopBar />
      {children}
    </div>
  );
}

function PageFallback() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <span className="w-8 h-8 border-2 border-line border-t-brand rounded-full animate-spin" aria-hidden="true" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/staff/:restaurantId" element={<AdminBoard />} />
        <Route path="/staff" element={<Navigate to={`/staff/${restaurants[0].id}`} replace />} />
        {/* старый путь: не ломаем ссылки, которые уже могли раздать сотрудникам */}
        <Route path="/admin" element={<Navigate to={`/staff/${restaurants[0].id}`} replace />} />
        <Route path="/" element={<Shell><Home /></Shell>} />
        <Route path="/restaurant/:id" element={<Shell><RestaurantMenu /></Shell>} />
        <Route path="/order/:orderId" element={<Shell><OrderTracking /></Shell>} />
        <Route path="/my-orders" element={<Shell><MyOrders /></Shell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
