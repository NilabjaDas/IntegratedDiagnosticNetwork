import React from "react";
import { Layout, Menu } from "antd";
import { Link, useLocation } from "react-router-dom";
import {
  HomeOutlined,
  CrownOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  UserOutlined,
  VideoCameraOutlined,
  UploadOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { setPageLocation } from "../redux/uiRedux";
import techFloaterLogo from "../assets/TechFloaterLogo.png";
import techFloaterSymbol from "../assets/TechFloaterSymbol.png";
const { Sider } = Layout;

const Sidebar = ({ collapsed }) => {
  const location = useLocation();
  const dispatch = useDispatch();
  const theme = useSelector(
    (state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme
  );

  const handleMenuClick = (e) => {
    dispatch(setPageLocation(e.key));
  };

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={220}
      style={{
        overflow: "auto",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 10,
        // Force white background in light mode to avoid default navy blue
        background: theme === "dark" ? "#181818" : "#ffffff",
        borderRight: theme === "dark" ? "1px solid #303030" : "none",
        boxShadow:
          theme === "light" ? "2px 0 8px 0 rgba(29,35,41,.05)" : "none",
      }}
    >
      {collapsed ? (
        <div
          style={{
            height: "32px",
            margin: "16px",
            // Optional: Use flex to center if the image aspect ratio leaves gaps
            display: "flex",
            // justifyContent: "center",
            alignItems: "center",
            // background: theme === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
          }}
        >
          <img
            src={techFloaterSymbol}
            alt="Logo"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain", // Ensures the full logo is visible without stretching
              display: "block", // Removes potential extra space below the image
            }}
          />
        </div>
      ) : (
        <div
          style={{
            height: "32px",
            margin: "16px",
            // Optional: Use flex to center if the image aspect ratio leaves gaps
            display: "flex",
            // justifyContent: "center",
            alignItems: "center",
            // background: theme === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
          }}
        >
          <img
            src={techFloaterLogo}
            alt="Logo"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover", // Ensures the full logo is visible without stretching
              display: "block", // Removes potential extra space below the image
            }}
          />
        </div>
      )}
      <Menu
        theme={theme === "dark" ? "dark" : "light"}
        mode="inline"
        defaultSelectedKeys={["/"]}
        selectedKeys={[location.pathname]}
        onClick={handleMenuClick}
        style={{
          background: "transparent", // Ensure menu doesn't paint over the Sider background
        }}
      >
        <Menu.Item key="/" icon={<HomeOutlined />}>
          <Link to="/">Home</Link>
        </Menu.Item>
        <Menu.Item key="/institutions" icon={<CrownOutlined />}>
          <Link to="/institutions">Institutions</Link>
        </Menu.Item>
        <Menu.Item key="/tests-directory" icon={<ExperimentOutlined />}>
          <Link to="/tests-directory">Tests Directory</Link>
        </Menu.Item>
        <Menu.Item key="/template-library" icon={<FilePdfOutlined />}>
          <Link to="/template-library">Template Library</Link>
        </Menu.Item>
        <Menu.Item key="/page1" icon={<UserOutlined />}>
          <Link to="/page1">Page 1</Link>
        </Menu.Item>
        <Menu.Item key="/page2" icon={<VideoCameraOutlined />}>
          <Link to="/page2">Page 2</Link>
        </Menu.Item>
        <Menu.Item key="/page3" icon={<UploadOutlined />}>
          <Link to="/page3">Page 3</Link>
        </Menu.Item>
      </Menu>
    </Sider>
  );
};

export default Sidebar;
