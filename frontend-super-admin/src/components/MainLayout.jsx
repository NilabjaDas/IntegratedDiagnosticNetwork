import React from "react";
import { Layout } from "antd";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useSelector } from "react-redux";

const { Content } = Layout;

const MainLayout = ({ children }) => {
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout
        className="site-layout"
        style={{
          background: theme === "dark" ? "#001529" : "#fff",
        }}
      >
        <Navbar />
        <Content style={{ margin: "0 16px" }}>
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
