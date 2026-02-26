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
import Page1 from "./pages/Page1";
import Page2 from "./pages/Page2";
import Page3 from "./pages/Page3";
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
import ClinicalManagerPage from './pages/ClinicalManagerPage';
import DoctorWorkspacePage from './pages/DoctorWorkspacePage';
import moment from "moment";
import QueueManagerPage from "./pages/QueueManagerPage";
import TvDisplayPage from "./pages/TvDisplayPage";
import { addTokenSuccess, getQueueSuccess } from "./redux/queueRedux";

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

/**
 * Inline ProtectedRoute so no extra file required.
 * It simply checks auth token in redux and redirects to /login if missing.
 */
const ProtectedRoute = ({ children }) => {
  const token = useSelector(
    (state) => state[process.env.REACT_APP_ACCESS_TOKEN_KEY]?.token
  );
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  const theme = useSelector(
    (state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme
  );
  const dispatch = useDispatch();
  // --- selectors (kept those still used) ---
  const institutionDetails = useSelector(
    (state) => state[process.env.REACT_APP_INSTITUTIONS_DATA_KEY].brandDetails
  );
  const institutionStatus = useSelector(
    (state) => state[process.env.REACT_APP_INSTITUTIONS_DATA_KEY].status
  );
  const token = useSelector(
    (state) => state[process.env.REACT_APP_ACCESS_TOKEN_KEY]?.token
  );
  const maintenanceDataFromRedux = useSelector(
    (state) => state[process.env.REACT_APP_UI_DATA_KEY]?.scheduledMaintenance
  );

  // local UI state
  const [maintenanceData, setMaintenanceData] = useState(
    maintenanceDataFromRedux
  );
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(
    maintenanceDataFromRedux?.activeStatus
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [modalResponse, setModalResponse] = useState(false);
  
  // utility to check if current route is login
  const isOnLoginRoute = () => {
    try {
      return window.location.pathname === "/login";
    } catch {
      return false;
    }
  };

  // -------------------------
  // Ping effect
  // -------------------------
  useEffect(() => {
    if (!token) return; // don't run anything unless token exists

    const pingServer = async () => {
      if (isOnLoginRoute()) return;
      try {
        // We just call getPing. 
        // If it returns 403/401, the Axios Interceptor in requestMethods.js 
        // will automatically dispatch CLEAR_ALL_REDUCERS.
        await getPing(dispatch);
      } catch (error) {
        console.error("Ping failed:", error);
      }
    };

    // immediate ping once token is available
    pingServer();

    const interval = setInterval(() => {
      pingServer();
    }, 600000); // 10 minutes

    return () => clearInterval(interval);
  }, [token, dispatch]);

  // -------------------------
  // Fetch brand details (unchanged)
  // -------------------------
  useEffect(() => {
    const fetchInstitutionDetails = async () => {
      await getInstitutionStatus(dispatch);
      await getInstitutionDetails(dispatch);
    };
    fetchInstitutionDetails();
  }, [dispatch]);

  // -------------------------
  // Initial Data Load
  // -------------------------
  useEffect(() => {
    const today = moment().format("YYYY-MM-DD");
    // Load initial data
    if (token) {
      getMyTests(dispatch, today);
      getPackages(dispatch);
    }
  }, [dispatch, token]);

  // -------------------------
  // SSE / EventSource
  // -------------------------
  useEffect(() => {
    let eventSource;
    let retryTimeout;

    const connectEventSource = () => {
      if (!token) return;

      const eventUrl =
        BASE_URL === "/"
          ? `/server/events?token=${token}&domain=${currentDomain}`
          : `${BASE_URL}/server/events?token=${token}&domain=${currentDomain}`;

      eventSource = new EventSource(eventUrl);

      // --- NEW: Listen for Authentication Errors from SSE ---
      eventSource.addEventListener("error", (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data && (data.message === "Token expired" || data.message === "Unauthorized")) {
                console.warn("SSE Auth Error:", data.message);
                eventSource.close();
                dispatch({ type: CLEAR_ALL_REDUCERS }); // Force logout
            }
        } catch (e) {
            // Standard network error or connection drop will be handled by onerror
        }
      });

      eventSource.onmessage = (event) => {
        // console.log("SSE message:", event.data);
      };

      eventSource.addEventListener("adminLogout", (event) => {
        const data = JSON.parse(event.data);
        if (data.domain === currentDomain) {
          toast.info(`${data.message}`, {
            position: "top-right",
            autoClose: 10000,
            hideProgressBar: false,
            draggable: true,
            progress: undefined,
            theme: "light",
            transition: Bounce,
          });
        }
        dispatch({ type: CLEAR_ALL_REDUCERS });
      });

      eventSource.addEventListener("scheduled_maintenance", (event) => {
        const data = JSON.parse(event.data);

        setMaintenanceData(data);
        if (data?.activeStatus) {
          // if maintenance active, clear reducers and force maintenance viewport
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
          const tokenContent = eventData.token;
           dispatch(addTokenSuccess(tokenContent));
      });

      eventSource.addEventListener("tests_availability_updated", (event) => {
        try {
          const payload = JSON.parse(event.data);
          const targetDate = payload.date; // "YYYY-MM-DD" from server

          // Option A: Always fetch the date that was modified
          if (targetDate) {
            getMyTests(dispatch, targetDate);
          } else {
            // Fallback to today if no date passed
            getMyTests(dispatch, moment().format("YYYY-MM-DD"));
          }
        } catch (e) {
          console.error("SSE Parse Error", e);
        }
      });

      eventSource.onerror = (error) => {
        // Standard EventSource error (network down, 401 status on handshake, etc)
        console.error("SSE error:", error);
        if (eventSource) eventSource.close();
        retryTimeout = setTimeout(() => {
          connectEventSource();
        }, 3000);
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

  const handleLogout = () => {
    dispatch({ type: CLEAR_ALL_REDUCERS });
  };

  const handleModalClose = () => {
    setModalOpen(false);
  };

  const handleModalResponse = (val) => {
    setModalResponse(val);
  };

  useEffect(() => {
    if (modalResponse) {
      handleLogout();
    }
  }, [modalResponse, handleLogout]);

  function BackWatcher() {
    const navigate = useNavigate();
    const blockedRef = useRef(false);

    useOnBack(
      (prevLocation, newLocation) => {
        if (blockedRef.current) {
          blockedRef.current = false;
          return;
        }

        // Only block if the user WAS on "/" when they pressed back
        if (prevLocation?.pathname === "/") {
          setModalOpen(true);
          blockedRef.current = true;
          navigate("/", { replace: true });
        }
      },
      {
        onForward: (prevLocation, newLocation) => {
          // optional: handle forward if needed
        },
      }
    );

    return null;
  }

  // -------------------------
  // Render (URL-based routing)
  // -------------------------
  return (
    <ConfigProvider theme={theme === "dark" ? darkTheme : {}}>
      <Helmet>
        <link
          rel="icon"
          href={
            institutionDetails?.favicon ||
            institutionDetails?.institutionSymbolUrl ||
            institutionDetails?.institutionLogoUrl
          }
        />
        <title>
          {`Medico Control Center | ${
            institutionDetails?.brandName || "TechFloater"
          }`}
        </title>
      </Helmet>

      <GlobalStyle />
      <ToastContainer />

      <Modal
        open={isMaintenanceModalOpen}
        footer={null}
        closable={false}
        width={478}
        style={{ borderRadius: "30px" }}
      >
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
        <LogoutModal
          open={modalOpen}
          close={handleModalClose}
          modalResponse={(val) => handleModalResponse(val)}
          yesText="Yes"
          noText="No"
        />
        <Routes>
          {/* Public login route: redirect to / if already logged in */}
          <Route
            path="/login"
            element={token ? <Navigate to="/" replace /> : <LoginPage />}
          />

          {/* Protected app routes (URL-based). Refreshing any of these stays on same URL */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/tests-management" element={<TestsPage />} />
                    <Route path="/orders-management" element={<OrdersPage />} />
                    <Route path="/queue-management" element={<QueueManagerPage />} />
                    <Route path="/configuration" element={<ConfigurationPage />} />
                    <Route path="/doctors" element={<ClinicalManagerPage />} />
                    <Route path="/doctor-workspace" element={<DoctorWorkspacePage />} />
                    <Route path="/page2" element={<Page2 />} />
                    <Route path="/page3" element={<Page3 />} />
                    <Route path="/tv-display/:department" element={<TvDisplayPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </MainLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;