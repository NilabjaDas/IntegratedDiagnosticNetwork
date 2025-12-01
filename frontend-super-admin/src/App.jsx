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

import {
  setScheduledMaintenanceData,
  viewPortData,
} from "./redux/uiRedux";

import { CLEAR_ALL_REDUCERS } from "./redux/actionTypes";
import { BASE_URL, currentDomain } from "./requestMethods";
import { Bounce, toast, ToastContainer } from "react-toastify";
import MaintenanceContainer from "./components/MaintenanceContainer";
import HomePage from "./pages/HomePage";
import Page1 from "./pages/Page1";
import Page2 from "./pages/Page2";
import Page3 from "./pages/Page3";
import { getPing } from "./redux/apiCalls";
import { getAllInstitutions } from "./redux/apiCalls";
import useOnBack from "./redux/useOnBack";
import LogoutModal from "./components/LogoutModal";
import MainLayout from "./components/MainLayout";
import InstitutionsPage from "./pages/InstitutionsPage";
import BaseTestsPage from "./pages/BaseTestsPage";
import TemplateLibraryPage from "./pages/TemplateLibraryPage";
import TemplateEditorPage from "./pages/TemplateEditorPage";

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
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);
  const dispatch = useDispatch();
  const blockedRef = useRef(false);

  const token = useSelector(
    (state) => state[process.env.REACT_APP_ACCESS_TOKEN_KEY].token
  );
  const maintenanceDataFromRedux = useSelector(
    (state) => state[process.env.REACT_APP_UI_DATA_KEY].scheduledMaintenance
  );

  // local UI state
  const [maintenanceData, setMaintenanceData] = useState(
    maintenanceDataFromRedux
  );
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(
    maintenanceDataFromRedux?.activeStatus
  );
  const [modalOpen, setModalOpen] = useState(false)
  const [modalResponse, setModalResponse] = useState(false)
  // utility to check if current route is login
  const isOnLoginRoute = () => {
    try {
      return window.location.pathname === "/login";
    } catch {
      return false;
    }
  };

  // -------------------------
  // Ping effect (uses route check instead of viewPort redux)
  // -------------------------
  useEffect(() => {
    if (!token) return; // don't run anything unless token exists

    const pingServer = async () => {
      if (isOnLoginRoute()) return;
      const res = await getPing(dispatch, /* pass viewPort if your API expects it */);
      if (res === 403) {
        alert("Session Has Expired");
        dispatch({ type: CLEAR_ALL_REDUCERS });
      }
    };

    // immediate ping once token is available
    pingServer().catch((error) => console.error("Ping failed:", error));

    const interval = setInterval(() => {
      pingServer().catch((error) => console.error("Ping failed:", error));
    }, 600000); // 10 minutes

    return () => clearInterval(interval);
  }, [token, dispatch]);




  // -------------------------
  // SSE / EventSource (kept intact, but uses route check instead of viewPortRef)
  // -------------------------
  useEffect(() => {
    let eventSource;
    let retryTimeout;

    const connectEventSource = () => {
      const eventUrl = BASE_URL === "/"
          ? `/server/events?token=${token}&domain=super-admin`
          : `${BASE_URL}/server/events?token=${token}&domain=super-admin`;

      eventSource = new EventSource(eventUrl);

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

        // Replace previous viewPortRef logic: if maintenance active -> 100, else -> 0
        // (This replicates the main effect of the original behavior without reading viewPort from Redux)
        dispatch(viewPortData(data?.activeStatus ? 100 : 0));
      });

     eventSource.addEventListener("institutions_updated", (event) => {
        // When server says data changed, we silently refetch Page 1
        // or we could check the current page from a global state if we stored it.
        // For safety, fetching Page 1 ensures list is fresh.
        console.log("SSE Received: institutions_updated");
        getAllInstitutions(dispatch, 1, 10, ""); 
      });

      eventSource.onerror = (error) => {
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
    <Navigate to="/" replace />
  };

   const handleModalClose = () =>{
    setModalOpen(false)
  }

  const handleModalResponse = (val) =>{
    setModalResponse(val)
  }

  useEffect(() => {
    if(modalResponse){
    handleLogout()
    }
  }, [modalResponse, handleLogout])


function BackWatcher() {
  const navigate = useNavigate();
  const blockedRef = useRef(false);

  useOnBack(
    (prevLocation, newLocation) => {
      // If we just programmatically corrected navigation, ignore this event.
      // (defensive — replace navigations shouldn't trigger onBack, but this avoids flicker/loops.)
      if (blockedRef.current) {
        // reset the flag and ignore
        blockedRef.current = false;
        return;
      }

      // Only block if the user WAS on "/" when they pressed back
      if (prevLocation?.pathname === "/") {
        setModalOpen(true)
        // Prevent leaving "/" by replacing the current entry with "/"
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
        <title>
          {`Medico Control Center | TechFloater`}
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
        <LogoutModal open={modalOpen} close={handleModalClose} modalResponse = {(val)=>handleModalResponse(val)}  yesText= "Yes" noText= "No"/>
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
                    <Route path="/institutions" element={<InstitutionsPage />} />
                    <Route path="/tests-directory" element={<BaseTestsPage />} />
                    <Route path="/template-library" element={<TemplateLibraryPage />} />
                    <Route path="/template-editor/:id" element={<TemplateEditorPage />} />
                    <Route path="/page1" element={<Page1 />} />
                    <Route path="/page2" element={<Page2 />} />
                    <Route path="/page3" element={<Page3 />} />
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
