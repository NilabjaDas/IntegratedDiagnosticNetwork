import React, { useEffect } from "react";
import { Tabs, Typography, message } from "antd";
import { FilePdfOutlined, CloudDownloadOutlined } from "@ant-design/icons";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { 
    getTenentTemplateLibrary, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate 
} from "../redux/apiCalls"; 
import BillingTemplateEditor from "../components/BillingTemplateEditor";
import TemplateLibrary from "../components/TemplateLibrary";

const { Title } = Typography;

const PageContainer = styled.div`
  padding: 24px;
  background: #fff;
  min-height: 100vh;
`;

const ConfigurationPage = () => {
  const dispatch = useDispatch();
  
  // Get templates from Redux
  const { printTemplates } = useSelector((state) => state[process.env.REACT_APP_TEMPLATELIBRARY_DATA_KEY]);

  // Initial Fetch
  useEffect(() => {
    getTenentTemplateLibrary(dispatch, "PRINT");
  }, [dispatch]);


  // --- CRUD WRAPPERS ---
  
  const handleCreate = async (initialData) => {
      try {
          const newTemplate = await createTemplate(dispatch, initialData);
          message.success("Template created successfully");
          return newTemplate;
      } catch (error) {
          message.error("Failed to create template");
      }
  };

  const handleUpdate = async (id, data) => {
      try {
          await updateTemplate(dispatch, id, data);
          message.success("Template saved successfully");
      } catch (error) {
          message.error("Failed to save changes");
      }
  };

  const handleDelete = async (id) => {
      try {
          await deleteTemplate(dispatch, id);
          message.success("Template deleted");
      } catch (error) {
          message.error("Failed to delete template");
      }
  };

  return (
    <PageContainer>
      <div style={{ marginBottom: 20 }}>
          <Title level={2}>Configuration</Title>
      </div>
      
      <Tabs defaultActiveKey="1" size="large" items={[
          {
            key: "1",
            label: <span><FilePdfOutlined /> My Templates</span>,
            children: (
                <BillingTemplateEditor 
                    templates={printTemplates || []} 
                    onCreate={handleCreate}
                    onUpdate={handleUpdate} 
                    onDelete={handleDelete}
                />
            ),
          },
          {
            key: "2",
            label: <span><CloudDownloadOutlined /> Template Library</span>,
            children: <TemplateLibrary />,
          }
      ]} />
    </PageContainer>
  );
};

export default ConfigurationPage;