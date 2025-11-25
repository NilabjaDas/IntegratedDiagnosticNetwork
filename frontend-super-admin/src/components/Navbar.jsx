import React, { useState } from "react";
import { Layout, Switch, Button } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { setTheme } from "../redux/uiRedux";
import LogoutModal from "./LogoutModal";
import { CLEAR_ALL_REDUCERS } from "../redux/actionTypes";
import { useNavigate } from "react-router-dom";

const { Header } = Layout;

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);
  const [modalOpen, setModalOpen] = useState(false);

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

  return (
    <Header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: theme === "dark" ? "#001529" : "#fff",
        padding: "0 24px",
      }}
    >
      <div></div>
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
      <LogoutModal
        open={modalOpen}
        close={handleModalClose}
        modalResponse={handleModalResponse}
        yesText="Yes"
        noText="No"
      />
    </Header>
  );
};

export default Navbar;
