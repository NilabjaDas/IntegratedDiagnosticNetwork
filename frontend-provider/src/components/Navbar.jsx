import React, { useState } from "react";
import { Layout, Switch, Button, theme as antTheme } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { setTheme } from "../redux/uiRedux";
import LogoutModal from "./LogoutModal";
import { CLEAR_ALL_REDUCERS } from "../redux/actionTypes";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "./Breadcrumbs";

const { Header } = Layout;

const Navbar = ({ collapsed, setCollapsed }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const institutionDetails =  useSelector((state) => state[process.env.REACT_APP_INSTITUTIONS_DATA_KEY].brandDetails)
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);
  const [modalOpen, setModalOpen] = useState(false);
  const {
    token: { colorBgContainer },
  } = antTheme.useToken();

  const handleThemeChange = (checked) => {
    const newTheme = checked ? "dark" : "light";
    dispatch(setTheme(newTheme));
  };

  const showLogoutModal = () => {
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
  };

  const handleLogout = () => {
    dispatch({ type: CLEAR_ALL_REDUCERS });
    navigate("/login");
  };

  const handleModalResponse = (response) => {
    if (response) {
      handleLogout();
    }
    setModalOpen(false);
  };

  const bgStyle = theme === "dark" ? "#141414" : colorBgContainer;
  const borderStyle = theme === "dark" ? "#303030" : "#f0f0f0";

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 999,
        width: "100%",
        boxShadow: "0 0px 0px rgba(0,0,0,0.15)",
      }}
    >
      {/* Main Top Bar */}
      <Header
        style={{
          padding: "0 24px",
          background: bgStyle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${borderStyle}`,
          height: "64px",
          lineHeight: "64px",
          transition: "background 0.3s, border-color 0.3s",
        }}
      >
     
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: "16px",
              width: 64,
              height: 64,
              color: theme === "dark" ? "white" : undefined,
              marginLeft: -24, // Aligns button flush with edge
            }}
          />
           <b>
                {institutionDetails?.institutionName}
          </b>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <Switch
            checkedChildren="Dark"
            unCheckedChildren="Light"
            checked={theme === "dark"}
            onChange={handleThemeChange}
            style={{ marginRight: "20px" }}
          />
          <Button type="primary" onClick={showLogoutModal}>
            Logout
          </Button>
        </div>
      </Header>

      {/* Breadcrumb Strip */}
      <div
        style={{
          background: bgStyle,
          padding: "10px 24px",
          borderBottom: `1px solid ${borderStyle}`,
          transition: "background 0.3s, border-color 0.3s",
        }}
      >
        <Breadcrumbs />
      </div>

      <LogoutModal
        open={modalOpen}
        close={handleModalClose}
        modalResponse={handleModalResponse}
        yesText="Yes"
        noText="No"
      />
    </div>
  );
};

export default Navbar;