import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import uzUZ from 'antd/locale/uz_UZ';
import { Provider } from 'react-redux';
import App from './app/App';
import { store } from './app/store';
import { AuthProvider } from './auth/AuthContext';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <ConfigProvider
          locale={uzUZ}
          theme={{
            algorithm: theme.defaultAlgorithm,
            token: {
              colorPrimary: '#4F46E5',
              colorInfo: '#4F46E5',
              colorSuccess: '#10B981',
              colorWarning: '#F59E0B',
              colorError: '#EF4444',
              colorText: '#111827',
              colorTextSecondary: '#6B7280',
              colorBgBase: '#F8FAFC',
              colorBgLayout: '#F8FAFC',
              colorBgContainer: '#FFFFFF',
              colorBorder: '#E5E7EB',
              borderRadius: 8,
              fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            },
            components: {
              Button: {
                primaryShadow: 'none',
              },
              DatePicker: {
                activeBorderColor: '#4F46E5',
                hoverBorderColor: '#4F46E5',
                activeShadow: '0 0 0 2px rgba(79, 70, 229, 0.14)',
              },
              Drawer: {
                colorBgElevated: '#FFFFFF',
              },
              Input: {
                activeBorderColor: '#4F46E5',
                hoverBorderColor: '#4F46E5',
                activeShadow: '0 0 0 2px rgba(79, 70, 229, 0.14)',
              },
              InputNumber: {
                activeBorderColor: '#4F46E5',
                hoverBorderColor: '#4F46E5',
                activeShadow: '0 0 0 2px rgba(79, 70, 229, 0.14)',
              },
              Select: {
                activeBorderColor: '#4F46E5',
                hoverBorderColor: '#4F46E5',
                activeOutlineColor: 'rgba(79, 70, 229, 0.14)',
                optionSelectedBg: 'rgba(79, 70, 229, 0.12)',
                optionSelectedColor: '#111827',
              },
            },
          }}
        >
          <App />
        </ConfigProvider>
      </AuthProvider>
    </Provider>
  </React.StrictMode>,
);
