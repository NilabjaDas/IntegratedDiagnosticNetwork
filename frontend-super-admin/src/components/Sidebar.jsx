import React from "react";
import { Layout, Menu } from "antd";
import { Link, useLocation } from "react-router-dom";
import {
  HomeOutlined,
  UserOutlined,
  VideoCameraOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useDispatch } from "react-redux";
import { setPageLocation } from "../redux/uiRedux";

const { Sider } = Layout;

const Sidebar = ({ collapsed }) => {
  const location = useLocation();
  const dispatch = useDispatch();

  const handleMenuClick = (e) => {
    dispatch(setPageLocation(e.key));
  };

  return (
    <Sider trigger={null} collapsible collapsed={collapsed}>
      <div className="logo" />
      <Menu
        theme="dark"
        mode="inline"
        defaultSelectedKeys={["/"]}
        selectedKeys={[location.pathname]}
        onClick={handleMenuClick}
      >
        <Menu.Item key="/" icon={<HomeOutlined />}>
          <Link to="/">Home</Link>
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
