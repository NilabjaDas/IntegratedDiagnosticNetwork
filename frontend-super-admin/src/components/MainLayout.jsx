import React, { useState } from "react";
import { Layout } from "antd";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useSelector } from "react-redux";

const { Header, Content } = Layout;

const MainLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar collapsed={collapsed} />
      <Layout
        className="site-layout"
        style={{
          background: theme === "dark" ? "#001529" : "#fff",
        }}
      >
        <Header style={{ padding: 0, background: theme === "dark" ? "#001529" : "#fff", position: 'fixed', zIndex: 1, width: '100%' }}>
          <Navbar collapsed={collapsed} toggleSidebar={toggleSidebar} />
        </Header>
        <Content style={{ margin: "0 16px", paddingTop: 64 }}>
          <div
            className="site-layout-background"
            style={{ padding: 24, minHeight: 360 }}
          >
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
