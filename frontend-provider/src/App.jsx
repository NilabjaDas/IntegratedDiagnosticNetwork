// App.jsx
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { ConfigProvider, Modal } from "antd";
import LoginPage from "./pages/LoginPage";
import { createGlobalStyle } from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { Helmet } from "react-helmet";
import { useEffect, useRef, useState } from "react";
import { darkTheme } from "./themes";
import { setAnalyticsData, setMasterReportsData } from "./redux/tokenRedux";
import { setScheduledMaintenanceData, viewPortData } from "./redux/uiRedux";

import { CLEAR_ALL_REDUCERS } from "./redux/actionTypes";
import { BASE_URL, currentDomain } from "./requestMethods";
import { Bounce, toast, ToastContainer } from "react-toastify";
import MaintenanceContainer from "./components/MaintenanceContainer";
import HomePage from "./pages/HomePage";
import {
  getInstitutionDetails,
  getInstitutionStatus,
  getMyTests,
  getPackages,
  getPing,
} from "./redux/apiCalls";

import useOnBack from "./redux/useOnBack";
import LogoutModal from "./components/LogoutModal";
import MainLayout from "./components/MainLayout";
import TestsPage from "./pages/TestsPage";
import OrdersPage from "./pages/OrdersPage";
import ConfigurationPage from "./pages/ConfigurationPage";
import DoctorWorkspacePage from './pages/DoctorWorkspacePage';
import moment from "moment";
import QueueManagerPage from "./pages/QueueManagerPage";
import TvDisplayPage from "./pages/TvDisplayPage";
import {updateTokenSuccess } from "./redux/queueRedux";
import ClinicalPage from "./pages/ClinicalPage";

// Global style to reset default margin and padding
const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
  }
`;

const ProtectedRoute = ({ children }) => {
  const token = useSelector(
    (state) => state[process.env.REACT_APP_ACCESS_TOKEN_KEY]?.token
  );
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);
  const dispatch = useDispatch();
  
  const institutionDetails = useSelector((state) => state[process.env.REACT_APP_INSTITUTIONS_DATA_KEY].brandDetails);
  const token = useSelector((state) => state[process.env.REACT_APP_ACCESS_TOKEN_KEY]?.token);
  const maintenanceDataFromRedux = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.scheduledMaintenance);

  const [maintenanceData, setMaintenanceData] = useState(maintenanceDataFromRedux);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(maintenanceDataFromRedux?.activeStatus);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalResponse, setModalResponse] = useState(false);
  
  const isOnLoginRoute = () => {
    try { return window.location.pathname === "/login"; } catch { return false; }
  };

  useEffect(() => {
    if (!token) return;
    const pingServer = async () => {
      if (isOnLoginRoute()) return;
      try {
        await getPing(dispatch);
      } catch (error) {
        console.error("Ping failed:", error);
      }
    };
    pingServer();
    const interval = setInterval(() => { pingServer(); }, 600000); 
    return () => clearInterval(interval);
  }, [token, dispatch]);

  useEffect(() => {
    const fetchInstitutionDetails = async () => {
      await getInstitutionStatus(dispatch);
      await getInstitutionDetails(dispatch);
    };
    fetchInstitutionDetails();
  }, [dispatch]);

  useEffect(() => {
    const today = moment().format("YYYY-MM-DD");
    if (token) {
      getMyTests(dispatch, today);
      getPackages(dispatch);
    }
  }, [dispatch, token]);

  useEffect(() => {
    let eventSource;
    let retryTimeout;

    const connectEventSource = () => {
      if (!token) return;

      const eventUrl = BASE_URL === "/"
          ? `/server/events?token=${token}&domain=${currentDomain}`
          : `${BASE_URL}/server/events?token=${token}&domain=${currentDomain}`;

      eventSource = new EventSource(eventUrl);

      eventSource.addEventListener("error", (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data && (data.message === "Token expired" || data.message === "Unauthorized")) {
                eventSource.close();
                dispatch({ type: CLEAR_ALL_REDUCERS }); 
            }
        } catch (e) {}
      });

      eventSource.addEventListener("adminLogout", (event) => {
        const data = JSON.parse(event.data);
        if (data.domain === currentDomain) {
          toast.info(`${data.message}`, { position: "top-right", autoClose: 10000, theme: "light", transition: Bounce });
        }
        dispatch({ type: CLEAR_ALL_REDUCERS });
      });

      eventSource.addEventListener("scheduled_maintenance", (event) => {
        const data = JSON.parse(event.data);
        setMaintenanceData(data);
        if (data?.activeStatus) {
          dispatch({ type: CLEAR_ALL_REDUCERS });
        }
        setIsMaintenanceModalOpen(data?.activeStatus || false);
        dispatch(setScheduledMaintenanceData(data));
        dispatch(viewPortData(data?.activeStatus ? 100 : 0));
      });

      eventSource.addEventListener("analytics_updated", (event) => {
        const data = JSON.parse(event.data);
        dispatch(setAnalyticsData(data));
      });

      eventSource.addEventListener("reports_updated", (event) => {
        const data = JSON.parse(event.data);
        dispatch(setMasterReportsData(data?.report?.properties));
      });

      eventSource.addEventListener("tests_queue_updated", (event) => {
          const eventData = JSON.parse(event.data);
          dispatch(updateTokenSuccess(eventData.token));
      });

     

      eventSource.addEventListener("tests_availability_updated", (event) => {
        try {
          const payload = JSON.parse(event.data);
          const targetDate = payload.date; 
          if (targetDate) {
            getMyTests(dispatch, targetDate);
          } else {
            getMyTests(dispatch, moment().format("YYYY-MM-DD"));
          }
        } catch (e) {
          console.error("SSE Parse Error", e);
        }
      });


      
      eventSource.onerror = (error) => {
        if (eventSource) eventSource.close();
        retryTimeout = setTimeout(() => { connectEventSource(); }, 3000);
      };
    };

    if (token) {
      connectEventSource();
    }

    return () => {
      if (eventSource) eventSource.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [token, dispatch]);

  const handleLogout = () => { dispatch({ type: CLEAR_ALL_REDUCERS }); };
  const handleModalClose = () => { setModalOpen(false); };
  const handleModalResponse = (val) => { setModalResponse(val); };

  useEffect(() => {
    if (modalResponse) { handleLogout(); }
  }, [modalResponse, handleLogout]);

  function BackWatcher() {
    const navigate = useNavigate();
    const blockedRef = useRef(false);

    useOnBack((prevLocation) => {
        if (blockedRef.current) {
          blockedRef.current = false;
          return;
        }
        if (prevLocation?.pathname === "/") {
          setModalOpen(true);
          blockedRef.current = true;
          navigate("/", { replace: true });
        }
      }, {});
    return null;
  }

  return (
    <ConfigProvider theme={theme === "dark" ? darkTheme : {}}>
      <Helmet>
        <link rel="icon" href={institutionDetails?.favicon || institutionDetails?.institutionSymbolUrl || institutionDetails?.institutionLogoUrl} />
        <title>{`Medico Control Center | ${institutionDetails?.brandName || "TechFloater"}`}</title>
      </Helmet>

      <GlobalStyle />
      <ToastContainer />

      <Modal open={isMaintenanceModalOpen} footer={null} closable={false} width={478} style={{ borderRadius: "30px" }}>
        {maintenanceData && (
          <MaintenanceContainer
            activeStatus={maintenanceData.activeStatus}
            startTime={maintenanceData.startTime}
            endTime={maintenanceData.endTime}
            updateInfo={maintenanceData.updateInfo}
            updateDescription={maintenanceData.updateDescription}
          />
        )}
      </Modal>

      <BrowserRouter>
        <BackWatcher />
        <LogoutModal open={modalOpen} close={handleModalClose} modalResponse={handleModalResponse} yesText="Yes" noText="No" />
        
        {/* --- FIXED ROUTES ARCHITECTURE --- */}
        <Routes>
            <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route path="/tv-display" element={<TvDisplayPage />} />

            {/* Protected Application Architecture */}
            <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                <Route index element={<HomePage />} />
                
             {/* Tests Management */}
                <Route path="tests-management" element={<Navigate to="/tests-management/my-tests" replace />} />
                <Route path="tests-management/:tab" element={<TestsPage />} />
                
                {/* Orders Management */}
                <Route path="orders-management" element={<Navigate to="/orders-management/orders" replace />} />
                <Route path="orders-management/:tab" element={<OrdersPage />} />

              {/* Queue Management */}
                <Route path="queue-management" element={<Navigate to="/queue-management/queue" replace />} />
                <Route path="queue-management/:tab" element={<QueueManagerPage />} />

             {/* Clinical Management */}
                <Route path="clinical-management" element={<Navigate to="/clinical-management/doctors" replace />} />
                <Route path="clinical-management/:tab" element={<ClinicalPage />} />

              {/* EMR Workspace */}
                <Route path="doctor-emr" element={<Navigate to="/doctor-emr/workspace" replace />} />
                <Route path="doctor-emr/:tab" element={<DoctorWorkspacePage />} />

             {/* Configuration */}
                <Route path="configuration" element={<Navigate to="/configuration/identity" replace />} />
                <Route path="configuration/:tab" element={<ConfigurationPage />} />
            </Route>
        </Routes>

      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;