import React, { useState, useEffect } from "react";
import { Layout, Menu } from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import {
  HomeOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  ProductOutlined,
  SettingOutlined,
  TeamOutlined,
  OrderedListOutlined,
  LaptopOutlined,
  FileTextOutlined,
  GiftOutlined,
  AppstoreAddOutlined,
  ShoppingCartOutlined,
  BarChartOutlined,
  UsergroupAddOutlined,
  PieChartOutlined,
  IdcardOutlined,
  DesktopOutlined,
  LineChartOutlined,
  ShopOutlined,
  ToolOutlined,
  BankOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  CreditCardOutlined,
  ApiOutlined,
  FilePdfOutlined,
  CloudDownloadOutlined
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { setPageLocation } from "../redux/uiRedux";

const { Sider } = Layout;

// Helper to construct the menu items array cleanly
function getItem(label, key, icon, children) {
  return { key, icon, children, label };
}

// Define the nested menu structure with Sub-Icons
const menuItems = [
  getItem("Home", "/", <HomeOutlined />),
  
  getItem("Tests Management", "sub_tests", <ExperimentOutlined />, [
    getItem("My Tests", "/tests-management/my-tests", <FileTextOutlined />),
    getItem("Health Packages", "/tests-management/packages", <GiftOutlined />),
    getItem("Add from Catalog", "/tests-management/master-catalog", <AppstoreAddOutlined />),
  ]),
  
  getItem("Orders Management", "sub_orders", <ProductOutlined />, [
    getItem("Orders Management", "/orders-management/orders", <ShoppingCartOutlined />),
    getItem("Reports", "/orders-management/reports", <BarChartOutlined />),
  ]),
  
  getItem("Queue Management", "sub_queue", <OrderedListOutlined />, [
    getItem("Queue Management", "/queue-management/queue", <UsergroupAddOutlined />),
    getItem("Reports", "/queue-management/reports", <PieChartOutlined />),
  ]),
  
  getItem("Clinical Management", "sub_clinical", <TeamOutlined />, [
    getItem("Doctor Directory", "/clinical-management/doctors", <IdcardOutlined />),
    getItem("Medicine Catalog", "/clinical-management/medicine", <MedicineBoxOutlined />),
    getItem("Clinical Tests", "/clinical-management/tests", <ExperimentOutlined />),
  ]),
  
  getItem("Doctor EMR", "sub_emr", <LaptopOutlined />, [
    getItem("Doctor Workspace", "/doctor-emr/workspace", <DesktopOutlined />),
    getItem("Reports", "/doctor-emr/reports", <LineChartOutlined />),
  ]),
  
 getItem("Configuration", "sub_config", <SettingOutlined />, [
    getItem("Branding & Contact", "/configuration/identity", <ShopOutlined />),
    getItem("General & Formats", "/configuration/general", <ToolOutlined />),
    getItem("Facilities & Rooms", "/configuration/infrastructure", <BankOutlined />),
    getItem("Patient Portal", "/configuration/patient-portal", <GlobalOutlined />),
    getItem("Data & Compliance", "/configuration/compliance", <SafetyCertificateOutlined />),
    getItem("Billing & Taxes", "/configuration/billing", <CreditCardOutlined />),
    getItem("Integrations", "/configuration/integrations", <ApiOutlined />),
    getItem("My Templates", "/configuration/templates", <FilePdfOutlined />),
    getItem("Template Library", "/configuration/template-library", <CloudDownloadOutlined />),
  ]),
];

// Helper to auto-open the correct folder on page load/refresh based on URL
const getParentKey = (path) => {
  if (path.startsWith("/configuration") || path.includes("template")) return ["sub_config"];
  if (path.startsWith("/clinical-management")) return ["sub_clinical"];
  if (path.startsWith("/doctor-emr")) return ["sub_emr"]; 
  if (path.includes("queue")) return ["sub_queue"];
  if (path.includes("order")) return ["sub_orders"];
  if (path.startsWith("/tests-management")) return ["sub_tests"];
  return [];
};

const Sidebar = ({ collapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);
  const institutionDetails = useSelector((state) => state[process.env.REACT_APP_INSTITUTIONS_DATA_KEY].brandDetails);

  const [openKeys, setOpenKeys] = useState([]);

  // Sync open accordion folders with the current URL
  useEffect(() => {
    setOpenKeys(getParentKey(location.pathname));
  }, [location.pathname]);

  const handleMenuClick = (e) => {
    dispatch(setPageLocation(e.key));
    navigate(e.key); 
  };

  const handleOpenChange = (keys) => {
    setOpenKeys(keys);
  };

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={260} 
      style={{
        // FIX: Removed 'overflow: auto' from the Sider wrapper so the layout stops scrolling as a single block
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 10,
        background: theme === "dark" ? "#000000" : "#ffffff",
        borderRight: theme === "dark" ? "1px solid #303030" : "none",
        boxShadow: theme === "light" ? "2px 0 8px 0 rgba(29,35,41,.05)" : "none",
      }}
    >
      {/* FIXED LOGO CONTAINER */}
      <div 
        style={{ 
          height: "80px", 
          margin: "16px", 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center",
          transition: "all 0.3s ease"
        }}
      >
        <img
          src={collapsed ? institutionDetails?.institutionSymbolUrl : institutionDetails?.institutionLogoUrl}
          alt="Institution Logo"
          style={{ 
            maxWidth: "100%", 
            maxHeight: "100%", 
            objectFit: "contain", 
            transition: "opacity 0.3s ease",
            display: "block"
          }}
        />
      </div>
      
      {/* SCROLLABLE MENU CONTAINER */}
      <div 
        style={{ 
          // FIX: Exact height calculation. 100vh minus Logo Height (80px) and Top/Bottom Margins (16px + 16px) = 112px
          height: "calc(100vh - 112px)", 
          overflowY: "auto", 
          overflowX: "hidden" 
        }}
        // Adding a custom scrollbar class here is recommended if you want to hide the ugly Windows scrollbar later
        className="sidebar-menu-container" 
      >
        <Menu
          theme={theme === "dark" ? "dark" : "light"}
          mode="inline"
          selectedKeys={[location.pathname]}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
          onClick={handleMenuClick}
          items={menuItems}
          style={{ background: "transparent", borderRight: 0 }}
        />
      </div>
    </Sider>
  );
};

export default Sidebar;