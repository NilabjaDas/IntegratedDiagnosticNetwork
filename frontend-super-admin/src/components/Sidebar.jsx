import React from "react";
import { Layout, Menu } from "antd";
import { Link, useLocation } from "react-router-dom";
import {
  HomeOutlined,
  UserOutlined,
  VideoCameraOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { setPageLocation } from "../redux/uiRedux";

const { Sider } = Layout;

const Sidebar = ({ collapsed }) => {
  const location = useLocation();
  const dispatch = useDispatch();
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);

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
        background: theme === "dark" ? "#000000" : "#ffffff",
        borderRight: theme === "dark" ? "1px solid #303030" : "none",
        boxShadow: theme === "light" ? "2px 0 8px 0 rgba(29,35,41,.05)" : "none",
      }}
    >
      <div
        className="logo"
        style={{
          height: "32px",
          margin: "16px",
          background: theme === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
        }}
      />
      <Menu
        theme={theme === "dark" ? "dark" : "light"}
        mode="inline"
        defaultSelectedKeys={["/"]}
        selectedKeys={[location.pathname]}
        onClick={handleMenuClick}
        style={{
            background: "transparent" // Ensure menu doesn't paint over the Sider background
        }}
      >
        <Menu.Item key="/" icon={<HomeOutlined />}>
          <Link to="/">Home</Link>
        </Menu.Item>
           <Menu.Item key="/institutions" icon={<UserOutlined />}>
          <Link to="/institutions">Institutions</Link>
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