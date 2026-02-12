import React, { useEffect } from "react";
import { Tabs, Layout, Typography } from "antd";
import { ExperimentOutlined, AppstoreAddOutlined, MedicineBoxOutlined } from "@ant-design/icons";
import styled from "styled-components";
import TestManager from "../components/TestManager";
import MasterCatalog from "../components/MasterCatalog";
import PackageManager from "../components/PackageManager";
import { useDispatch } from "react-redux";
import { getMyTests, getPackages } from "../redux/apiCalls";

const { Title } = Typography;

// --- Styled Components ---
const PageContainer = styled.div`
  /* padding: 24px; */
  min-height: 100vh;
  /* You can add more theme-specific styles here if needed */
  /* border-radius: 8px; */
  /* box-shadow: 0 2px 8px rgba(0,0,0,0.1); */
`;

const TestsPage = () => {


  const items = [
    {
      key: "1",
      label: (
        <span>
          <ExperimentOutlined />
          My Tests (Price List)
        </span>
      ),
      children: <TestManager />,
    },
    {
      key: "2",
      label: (
        <span>
          <MedicineBoxOutlined />
          Health Packages
        </span>
      ),
      children: <PackageManager />,
    },
    {
      key: "3",
      label: (
        <span>
          <AppstoreAddOutlined />
          Add from Master Catalog
        </span>
      ),
      children: <MasterCatalog />,
    },
  ];

  return (
    <PageContainer>
      {/* <Title level={2}>Tests Management</Title> */}
      <Tabs defaultActiveKey="1" items={items} size="large" />
    </PageContainer>
  );
};

export default TestsPage;