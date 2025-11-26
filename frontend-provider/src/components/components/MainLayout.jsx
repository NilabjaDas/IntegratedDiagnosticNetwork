import React, { useState } from "react";
import { Layout } from "antd";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useSelector } from "react-redux";

const { Content } = Layout;

const MainLayout = ({ children }) => {
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar collapsed={collapsed} />

      <Layout
        className="site-layout"
        style={{
          marginLeft: collapsed ? 80 : 220,
          transition: "margin-left 0.2s",
          background: theme === "dark" ? "#000000" : "#f5f5f5",
        }}
      >
        <Navbar collapsed={collapsed} setCollapsed={setCollapsed} />

        <Content style={{ margin: "24px 16px 0", overflow: "initial" }}>
          <div
            className="site-layout-background"
            style={{
              padding: 24,
              minHeight: 360,
              background: theme === "dark" ? "#141414" : "#fff",
              borderRadius: "4px",
            }}
          >
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;