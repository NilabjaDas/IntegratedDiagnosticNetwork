import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Input,
  Select,
  Switch,
  Button,
  List,
  Tag,
  Divider,
  ColorPicker,
  InputNumber,
  Tabs,
  Modal,
  Spin,
  Space,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  FormOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  SaveOutlined,
  TableOutlined,
  FileWordOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import RichTextEditor from "./RichTextEditor";
import { getTemplateConfig } from "../redux/apiCalls";
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
  CompressOutlined,
} from "@ant-design/icons";
const { Option } = Select;
const { confirm } = Modal;

// Paper Dimensions in Millimeters (mm)
const PAPER_SIZES = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  Thermal80mm: { width: 80, height: 297 }, // Thermal usually has infinite height, but we set a display height
};

// ... keep PAPER_SIZES constant ...

const PaperWrapper = ({ children, form, label }) => {
  const pageSize = Form.useWatch("pageSize", form) || "A4";
  const orientation = Form.useWatch("orientation", form) || "portrait";
  const margins = Form.useWatch("margins", form) || {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10,
  };

  // -- NEW: Zoom State --
  const [scale, setScale] = useState(0.75); // Default to 75% so it fits most screens initially

  const baseDim = PAPER_SIZES[pageSize] || PAPER_SIZES["A4"];
  const isLandscape = orientation === "landscape" && pageSize !== "Thermal80mm";

  const paperWidth = isLandscape ? baseDim.height : baseDim.width;
  const paperHeight = isLandscape ? baseDim.width : baseDim.height;

  const isFooter = label?.toLowerCase().includes("footer");

  // --- STYLES ---
  const containerStyle = {
    background: "#525659",
    padding: "40px",
    height: "100%",
    minHeight: "500px",
    overflow: "auto",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center", // Center the scaled paper horizontally
    borderRadius: "4px",
    border: "1px solid #d9d9d9",
    position: "relative",
  };

  const wrapperInnerStyle = {
    position: "relative",
    // SCALE APPLIED HERE
    transform: `scale(${scale})`,
    transformOrigin: "top center", // Scales from top-center so it doesn't jump around
    transition: "transform 0.2s ease", // Smooth zooming

    // Key fix: layout still calculates space based on original size.
    // We add margin-bottom to compensate for the "ghost" height if we scale down,
    // or let it grow if we scale up.
    marginBottom: scale < 1 ? `-${paperHeight * (1 - scale)}mm` : 0,
    flexShrink: 0,
  };

  const paperStyle = {
    width: `${paperWidth}mm`,
    height: `${paperHeight}mm`,
    background: "white",
    boxShadow: "0 0 10px rgba(0,0,0,0.5)",
    position: "relative",
    paddingTop: `${margins.top || 0}mm`,
    paddingBottom: `${margins.bottom || 0}mm`,
    paddingLeft: `${margins.left || 0}mm`,
    paddingRight: `${margins.right || 0}mm`,
    boxSizing: "border-box",
    overflow: "hidden",
  };

  const toolbarStyle = {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(4px)",
    borderRadius: "20px",
    padding: "4px 8px",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  };

  const btnStyle = {
    color: "#fff",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "16px",
  };

  const innerContentStyle = {
    position: "relative",
    zIndex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: isFooter ? "flex-end" : "flex-start",
  };

  const watermarkStyle = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) rotate(-45deg)",
    fontSize: "40px",
    color: "rgba(0,0,0,0.05)",
    pointerEvents: "none",
    zIndex: 0,
    whiteSpace: "nowrap",
  };

  const labelBadgeStyle = {
    position: "absolute",
    top: -25,
    left: 0,
    color: "#fff",
    fontSize: "12px",
    whiteSpace: "nowrap",
  };

  // Zoom Handlers
  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 2.0));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.3));
  const handleReset = () => setScale(1);
  const handleFit = () => setScale(0.65); // A nice "view all" size

  return (
    <div style={containerStyle} className="paper-scroll-container">
      {/* ZOOM TOOLBAR */}
      <div style={toolbarStyle}>
        <Button
          type="text"
          size="small"
          icon={<CompressOutlined />}
          style={btnStyle}
          onClick={handleFit}
          title="Fit to View"
        />
        <Button
          type="text"
          size="small"
          icon={<ZoomOutOutlined />}
          style={btnStyle}
          onClick={handleZoomOut}
        />
        <span
          style={{
            color: "#fff",
            fontSize: "12px",
            minWidth: "35px",
            textAlign: "center",
          }}
        >
          {Math.round(scale * 100)}%
        </span>
        <Button
          type="text"
          size="small"
          icon={<ZoomInOutlined />}
          style={btnStyle}
          onClick={handleZoomIn}
        />
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          style={btnStyle}
          onClick={handleReset}
          title="Reset 100%"
        />
      </div>

      <div style={wrapperInnerStyle}>
        {/* Label above the paper */}
        <div style={labelBadgeStyle}>
          {label} — {pageSize} ({paperWidth}mm x {paperHeight}mm)
        </div>

        {/* The Paper Itself */}
        <div style={paperStyle}>
          <div style={watermarkStyle}>{label} Designing</div>
          <div style={innerContentStyle}>{children}</div>
        </div>
      </div>
    </div>
  );
};
const TemplateEditor = ({ templates, onCreate, onUpdate, onDelete }) => {
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({ variables: [], tableKeys: [] });
  const [form] = Form.useForm();
  const selectedCategory = Form.useWatch("category", form);
  const selectedType = Form.useWatch("type", form);

  useEffect(() => {
    const fetchConfig = async () => {
      const data = await getTemplateConfig();
      setConfig(data);
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      const typeToFetch = selectedType || "BILL";
      const data = await getTemplateConfig(typeToFetch);
      if (data) setConfig(data);
    };
    if (selectedType) fetchConfig();
  }, [selectedType]);

  useEffect(() => {
    if (
      editingId &&
      !templates.find((t) => t.templateId === editingId) &&
      !templates.find((t) => t._id === editingId)
    ) {
      setEditingId(null);
      form.resetFields();
    }
  }, [templates, editingId, form]);

  const filteredTemplates = templates?.filter((t) => {
    const type = t.printDetails?.type || t.type;
    return filterType === "ALL" ? true : type === filterType;
  });

  const handleEdit = (template) => {
    setEditingId(template._id);
    const formData = {
      ...template,
      ...template.printDetails,
      content: template.printDetails?.content || template.content || {},
    };
    form.setFieldsValue(formData);
  };

  const handleCreateClick = async () => {
    setLoading(true);
    const newTemplatePayload = {
      name: "New Template",
      category: "PRINT",
      isDefault: false,
      // Default Print Details
      printDetails: {
        type: "BILL",
        pageSize: "A4",
        orientation: "portrait",
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
        content: {
          // REMOVED: accentColor, fontFamily, showLogo, showInstitutionDetails, showQrCode
          headerHtml: "<h1>{{institution.name}}</h1>",
          footerHtml: "<p>Generated by System</p>",
          tableStructure: {
            showHead: true,
            density: "normal",
            striped: false,
            columns: [
              {
                id: "1",
                label: "#",
                dataKey: "index",
                width: "5%",
                align: "center",
                visible: true,
              },
              {
                id: "2",
                label: "Description",
                dataKey: "name",
                width: "55%",
                align: "left",
                visible: true,
              },
              {
                id: "3",
                label: "Price",
                dataKey: "price",
                width: "20%",
                align: "right",
                visible: true,
              },
              {
                id: "4",
                label: "Total",
                dataKey: "total",
                width: "20%",
                align: "right",
                visible: true,
              },
            ],
            summarySettings: {
              showTax: true,
              showDiscount: true,
              showDues: true,
              wordsAmount: true,
            },
          },
        },
      },
      // Default Communication Details (Matches Schema)
      commDetails: {
        triggerEvent: "NONE",
        channels: {
          sms: { enabled: false, content: "", templateId: "" },
          email: { enabled: false, subject: "", bodyHtml: "" },
          whatsapp: { enabled: false, templateId: "" },
        },
      },
    };

    const createdTemplate = await onCreate(newTemplatePayload);
    setLoading(false);
    if (createdTemplate) handleEdit(createdTemplate);
  };

  const handleSaveClick = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const currentTemplate = templates.find((t) => t._id === editingId) || {};
      const existingPrintDetails = currentTemplate.printDetails || {};
      const existingContent = existingPrintDetails.content || {};

      // REMOVED: accentColor logic

      const formColumns =
        values.content?.tableStructure?.columns ||
        existingContent.tableStructure?.columns ||
        [];

      const processedColumns = formColumns.map((col) => ({
        ...col,
        id:
          col.id ||
          `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      const apiPayload = {
        institutionId: values.institutionId || currentTemplate.institutionId,
        name: values.name,
        category: values.category, // Ensure category is updated
        isDefault:
          values.isDefault !== undefined
            ? values.isDefault
            : currentTemplate.isDefault,

        // CONDITIONAL PAYLOAD BASED ON CATEGORY
        ...(values.category === "PRINT"
          ? {
              printDetails: {
                type: values.type,
                pageSize: values.pageSize,
                orientation: values.orientation,
                margins: values.margins || existingPrintDetails.margins,
                content: {
                  ...existingContent,
                  ...values.content,
                  tableStructure: {
                    ...(existingContent.tableStructure || {}),
                    ...(values.content?.tableStructure || {}),
                    columns: processedColumns,
                  },
                },
              },
              commDetails: undefined, // Unset comm details if switching to print
            }
          : {
              commDetails: values.commDetails,
              printDetails: undefined, // Unset print details if switching to comm
            }),
      };

      await onUpdate(editingId, apiPayload);
      setLoading(false);
    } catch (error) {
      console.error("Validation Failed:", error);
      setLoading(false);
    }
  };

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    confirm({
      title: "Delete Template?",
      icon: <ExclamationCircleOutlined />,
      okText: "Yes, Delete",
      okType: "danger",
      onOk() {
        if (editingId === id) {
          setEditingId(null);
          form.resetFields();
        }
        onDelete(id);
      },
    });
  };

  return (
    <Row gutter={24} style={{ height: "100%" }}>
      {/* LEFT: LIST */}
      <Col
        span={4}
        style={{ borderRight: "1px solid #f0f0f0", minHeight: "75vh" }}
      >
        <div style={{ marginBottom: 16 }}>
          <Button
            block
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleCreateClick}
            loading={loading}
            style={{ marginBottom: 10 }}
          >
            Create New Template
          </Button>
          <Select
            defaultValue="ALL"
            style={{ width: "100%" }}
            onChange={setFilterType}
          >
            <Option value="ALL">All Types</Option>
            <Option value="BILL">Bills</Option>
            <Option value="LAB_REPORT">Lab Reports</Option>
            <Option value="PRESCRIPTION">Prescriptions</Option>
          </Select>
        </div>
        <List
          dataSource={filteredTemplates}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="del"
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => handleDeleteClick(e, item._id)}
                />,
              ]}
              style={{
                background: item._id === editingId ? "#e6f7ff" : "white",
                border:
                  item._id === editingId
                    ? "1px solid #1890ff"
                    : "1px solid #f0f0f0",
                padding: "10px",
                borderRadius: 6,
                marginBottom: 8,
                cursor: "pointer",
              }}
              onClick={() => handleEdit(item)}
            >
              <List.Item.Meta
                title={<span style={{ fontWeight: 500 }}>{item.name}</span>}
                description={
                  <div style={{ fontSize: 11 }}>
                    <Tag color="blue">{item.printDetails?.type}</Tag>
                    {item.isDefault && <Tag color="green">Default</Tag>}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Col>

      {/* RIGHT: EDITOR */}
      <Col span={20}>
        {editingId ? (
          <Form layout="vertical" form={form}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 15,
                borderBottom: "1px solid #eee",
                paddingBottom: 10,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: "bold" }}>
                Editing Template
              </span>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveClick}
                loading={loading}
              >
                Save Changes
              </Button>
            </div>

            <Form.Item name="institutionId" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="templateId" hidden>
              <Input />
            </Form.Item>

            <Tabs
              defaultActiveKey="settings"
              items={[
                {
                  key: "settings",
                  forceRender: true,
                  label: (
                    <span>
                      <FormOutlined /> Page Settings
                    </span>
                  ),
                  children:
                    selectedCategory === "COMMUNICATION" ? (
                      <div
                        style={{
                          height: "75vh",
                          overflowY: "auto",
                          paddingRight: 10,
                        }}
                      >
                        {/* 1. General Settings & Trigger */}
                        <Card
                          size="small"
                          title="General Settings"
                          style={{ marginBottom: 16 }}
                        >
                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item
                                name="name"
                                label="Template Name"
                                rules={[{ required: true }]}
                              >
                                <Input />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="category" label="Category">
                                <Select>
                                  <Option value="PRINT">Print</Option>
                                  <Option value="COMMUNICATION">Digital</Option>
                                </Select>
                              </Form.Item>
                            </Col>
                          </Row>
                          <Divider dashed />
                          <Row gutter={16}>
                            <Col span={16}>
                              <Form.Item
                                name={["commDetails", "triggerEvent"]}
                                label="Automation Trigger"
                                extra="When should this message be sent automatically?"
                              >
                                <Select placeholder="Select Trigger Event">
                                  <Option value="NONE">
                                    No Automation (Manual Send Only)
                                  </Option>
                                  <Option value="ORDER_CREATED">
                                    Order Created
                                  </Option>
                                  <Option value="REPORT_READY">
                                    Lab Report Ready
                                  </Option>
                                  <Option value="PAYMENT_RECEIVED">
                                    Payment Received
                                  </Option>
                                </Select>
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item
                                name="isDefault"
                                label="Set as Default"
                                valuePropName="checked"
                              >
                                <Switch />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>

                        {/* 2. SMS Channel */}
                        <Card
                          size="small"
                          title="SMS Channel"
                          style={{ marginBottom: 16 }}
                        >
                          <Row gutter={16}>
                            <Col span={6}>
                              <Form.Item
                                name={[
                                  "commDetails",
                                  "channels",
                                  "sms",
                                  "enabled",
                                ]}
                                valuePropName="checked"
                                label="Enable SMS"
                              >
                                <Switch />
                              </Form.Item>
                            </Col>
                            <Col span={18}>
                              <Form.Item
                                name={[
                                  "commDetails",
                                  "channels",
                                  "sms",
                                  "templateId",
                                ]}
                                label="DLT Template ID"
                              >
                                <Input placeholder="1007..." />
                              </Form.Item>
                            </Col>
                            <Col span={24}>
                              <Form.Item
                                name={[
                                  "commDetails",
                                  "channels",
                                  "sms",
                                  "content",
                                ]}
                                label="SMS Content"
                              >
                                <Input.TextArea
                                  rows={3}
                                  showCount
                                  maxLength={160}
                                  placeholder="Dear {{patient_name}}, your report is ready..."
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>

                        {/* 3. Email Channel */}
                        <Card
                          size="small"
                          title="Email Channel"
                          style={{ marginBottom: 16 }}
                        >
                          <Row gutter={16}>
                            <Col span={6}>
                              <Form.Item
                                name={[
                                  "commDetails",
                                  "channels",
                                  "email",
                                  "enabled",
                                ]}
                                valuePropName="checked"
                                label="Enable Email"
                              >
                                <Switch />
                              </Form.Item>
                            </Col>
                            <Col span={18}>
                              <Form.Item
                                name={[
                                  "commDetails",
                                  "channels",
                                  "email",
                                  "subject",
                                ]}
                                label="Email Subject"
                              >
                                <Input placeholder="Lab Report Result..." />
                              </Form.Item>
                            </Col>
                            <Col span={24}>
                              <Form.Item
                                label="Email Body (HTML)"
                                name={[
                                  "commDetails",
                                  "channels",
                                  "email",
                                  "bodyHtml",
                                ]}
                              >
                                <RichTextEditor
                                  placeholder="Draft email body..."
                                  availableVariables={config.variables}
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>

                        {/* 4. WhatsApp Channel */}
                        {/* 4. WhatsApp Channel */}
                        <Card
                          size="small"
                          title="WhatsApp Channel"
                          style={{ marginBottom: 16 }}
                        >
                          <Row gutter={16}>
                            <Col span={6}>
                              <Form.Item
                                name={[
                                  "commDetails",
                                  "channels",
                                  "whatsapp",
                                  "enabled",
                                ]}
                                valuePropName="checked"
                                label="Enable WhatsApp"
                              >
                                <Switch />
                              </Form.Item>
                            </Col>
                            <Col span={18}>
                              <Form.Item
                                name={[
                                  "commDetails",
                                  "channels",
                                  "whatsapp",
                                  "templateName",
                                ]} // Changed to templateName
                                label="Meta Template Name"
                                extra="e.g. 'lab_report_v1'"
                              >
                                <Input placeholder="template_name_from_meta" />
                              </Form.Item>
                            </Col>

                            {/* 🟢 NEW: Media Type Selector */}
                            <Col span={12}>
                              <Form.Item
                                name={[
                                  "commDetails",
                                  "channels",
                                  "whatsapp",
                                  "headerType",
                                ]}
                                label="Header Media Type"
                              >
                                <Select>
                                  <Option value="NONE">
                                    Text Only (No Media)
                                  </Option>
                                  <Option value="DOCUMENT">
                                    Document (PDF for Bills/Rx)
                                  </Option>
                                  <Option value="IMAGE">
                                    Image (Promotions)
                                  </Option>
                                </Select>
                              </Form.Item>
                            </Col>

                            {/* Dynamic Variable Mapping - You can add this later if needed */}
                            <Col span={24}>
                              <div style={{ color: "#888", fontSize: "12px" }}>
                                Note: If 'Document' is selected, the system will
                                automatically attach the generated PDF of this
                                template.
                              </div>
                            </Col>
                          </Row>
                        </Card>
                      </div>
                    ) : (
                      <Card size="small">
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              name="name"
                              label="Template Name"
                              rules={[{ required: true }]}
                            >
                              <Input />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="category" label="Category">
                              <Select>
                                <Option value="PRINT">PRINT</Option>
                                <Option value="COMMUNICATION">
                                  COMMUNICATION
                                </Option>
                              </Select>
                            </Form.Item>
                          </Col>
                        </Row>
                        <Row gutter={16}>
                          <Col span={8}>
                            <Form.Item
                              name="type"
                              label="Template Type"
                              rules={[{ required: true }]}
                            >
                              <Select>
                                <Option value="BILL">Bill</Option>
                                <Option value="LAB_REPORT">Lab Report</Option>
                                <Option value="PRESCRIPTION">
                                  Prescription
                                </Option>
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="pageSize" label="Page Size">
                              <Select>
                                <Option value="Letter">Letter</Option>
                                <Option value="Legal">Legal</Option>
                                <Option value="Tabloid">Tabloid</Option>
                                <Option value="B4">B4</Option>
                                <Option value="B5">B5</Option>
                                <Option value="A3">A3</Option>
                                <Option value="A4">A4</Option>
                                <Option value="A5">A5</Option>
                                <Option value="Thermal80mm">Thermal</Option>
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="orientation" label="Orientation">
                              <Select>
                                <Option value="portrait">Portrait</Option>
                                <Option value="landscape">Landscape</Option>
                              </Select>
                            </Form.Item>
                          </Col>
                        </Row>
                        <Row gutter={16}>
                          <Col span={8}>
                            <Form.Item
                              name="isDefault"
                              label="Set as Default"
                              valuePropName="checked"
                            >
                              <Switch />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Divider orientation="left">Margins (mm)</Divider>
                        <div style={{ display: "flex", gap: 10 }}>
                          <Form.Item name={["margins", "top"]} noStyle>
                            <InputNumber
                              addonBefore="T"
                              style={{ width: "100%" }}
                              placeholder="0"
                            />
                          </Form.Item>
                          <Form.Item name={["margins", "right"]} noStyle>
                            <InputNumber
                              addonBefore="R"
                              style={{ width: "100%" }}
                              placeholder="0"
                            />
                          </Form.Item>
                          <Form.Item name={["margins", "bottom"]} noStyle>
                            <InputNumber
                              addonBefore="B"
                              style={{ width: "100%" }}
                              placeholder="0"
                            />
                          </Form.Item>
                          <Form.Item name={["margins", "left"]} noStyle>
                            <InputNumber
                              addonBefore="L"
                              style={{ width: "100%" }}
                              placeholder="0"
                            />
                          </Form.Item>
                        </div>
                      </Card>
                    ),
                },
                selectedCategory === "PRINT" && {
                  key: "design",
                  forceRender: true,
                  label: (
                    <span>
                      <FileWordOutlined /> Design Editor
                    </span>
                  ),
                  children: (
                    <div style={{ height: "65vh", overflowY: "auto" }}>
                      <Card
                        size="small"
                        title="Header Design"
                        style={{ marginTop: 16 }}
                      >
                        <PaperWrapper form={form} label="Header">
                          <Form.Item name={["content", "headerHtml"]} noStyle>
                            <RichTextEditor
                              placeholder="Design your header..."
                              availableVariables={config.variables}
                            />
                          </Form.Item>
                        </PaperWrapper>
                      </Card>

                      <Card
                        size="small"
                        title="Footer Design"
                        style={{ marginTop: 16 }}
                      >
                        <PaperWrapper form={form} label="Footer">
                          <Form.Item name={["content", "footerHtml"]} noStyle>
                            <RichTextEditor
                              placeholder="Design your footer..."
                              availableVariables={config.variables}
                            />
                          </Form.Item>
                        </PaperWrapper>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "table",
                  forceRender: true,
                  label: (
                    <span>
                      <TableOutlined /> Table & Data
                    </span>
                  ),
                  children: (
                    <div
                      style={{
                        height: "65vh",
                        overflowY: "auto",
                        paddingRight: 10,
                      }}
                    >
                      <Card
                        size="small"
                        title="Table Appearance"
                        style={{ marginBottom: 16 }}
                      >
                        <Row gutter={16}>
                          <Col span={8}>
                            <Form.Item
                              name={["content", "tableStructure", "density"]}
                              label="Density"
                            >
                              <Select>
                                <Option value="compact">Compact</Option>
                                <Option value="normal">Normal</Option>
                                <Option value="spacious">Spacious</Option>
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              name={["content", "tableStructure", "showHead"]}
                              label="Show Header"
                              valuePropName="checked"
                            >
                              <Switch />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              name={["content", "tableStructure", "striped"]}
                              label="Zebra Stripes"
                              valuePropName="checked"
                            >
                              <Switch />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>

                      <Card
                        size="small"
                        title="Columns Configuration"
                        style={{ marginBottom: 16 }}
                      >
                        {/* Column Editor Implementation (Same as previous) */}
                        <div
                          style={{
                            display: "flex",
                            marginBottom: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#888",
                          }}
                        >
                          <div style={{ width: 40, textAlign: "center" }}>
                            Sort
                          </div>
                          <div style={{ width: 44, textAlign: "center" }}>
                            Show
                          </div>
                          <div style={{ width: 150, marginLeft: 8 }}>
                            Column Title
                          </div>
                          <div style={{ width: 150, marginLeft: 8 }}>
                            Map Data Value
                          </div>
                          <div style={{ width: 80, marginLeft: 8 }}>Width</div>
                          <div style={{ width: 90, marginLeft: 8 }}>Align</div>
                          <div style={{ width: 40 }}></div>
                        </div>
                        <Form.List
                          name={["content", "tableStructure", "columns"]}
                        >
                          {(fields, { add, remove, move }) => (
                            <>
                              {fields.map((field, index) => (
                                <Space
                                  key={field.key}
                                  style={{ display: "flex", marginBottom: 8 }}
                                  align="center"
                                >
                                  <Form.Item
                                    {...field}
                                    name={[field.name, "id"]}
                                    hidden
                                  >
                                    <Input />
                                  </Form.Item>
                                  <Space
                                    direction="vertical"
                                    size={0}
                                    style={{ width: 40 }}
                                  >
                                    <Button
                                      size="small"
                                      type="text"
                                      icon={
                                        <ArrowUpOutlined
                                          style={{ fontSize: 10 }}
                                        />
                                      }
                                      onClick={() => move(index, index - 1)}
                                      disabled={index === 0}
                                    />
                                    <Button
                                      size="small"
                                      type="text"
                                      icon={
                                        <ArrowDownOutlined
                                          style={{ fontSize: 10 }}
                                        />
                                      }
                                      onClick={() => move(index, index + 1)}
                                      disabled={index === fields.length - 1}
                                    />
                                  </Space>
                                  <Form.Item
                                    {...field}
                                    name={[field.name, "visible"]}
                                    valuePropName="checked"
                                    noStyle
                                  >
                                    <Switch size="small" />
                                  </Form.Item>
                                  <Form.Item
                                    {...field}
                                    name={[field.name, "label"]}
                                    noStyle
                                    rules={[{ required: true }]}
                                  >
                                    <Input
                                      placeholder="Title"
                                      style={{ width: 150 }}
                                    />
                                  </Form.Item>
                                  <Form.Item
                                    {...field}
                                    name={[field.name, "dataKey"]}
                                    noStyle
                                    rules={[{ required: true }]}
                                  >
                                    <Select
                                      style={{ width: 150 }}
                                      placeholder="Select Data"
                                    >
                                      {config.tableKeys.map((k) => (
                                        <Option key={k.value} value={k.value}>
                                          {k.label}
                                        </Option>
                                      ))}
                                    </Select>
                                  </Form.Item>
                                  <Form.Item
                                    {...field}
                                    name={[field.name, "width"]}
                                    noStyle
                                  >
                                    <Input
                                      placeholder="%"
                                      style={{ width: 80 }}
                                    />
                                  </Form.Item>
                                  <Form.Item
                                    {...field}
                                    name={[field.name, "align"]}
                                    noStyle
                                  >
                                    <Select style={{ width: 90 }}>
                                      <Option value="left">Left</Option>
                                      <Option value="center">Center</Option>
                                      <Option value="right">Right</Option>
                                    </Select>
                                  </Form.Item>
                                  <Button
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => remove(field.name)}
                                  />
                                </Space>
                              ))}
                              <Button
                                type="dashed"
                                onClick={() =>
                                  add({
                                    visible: true,
                                    width: "auto",
                                    align: "left",
                                  })
                                }
                                block
                                icon={<PlusOutlined />}
                              >
                                Add Column
                              </Button>
                            </>
                          )}
                        </Form.List>
                      </Card>
                      <Card size="small" title="Financial Summary Settings">
                        <Row gutter={16}>
                          <Col span={6}>
                            <Form.Item
                              name={[
                                "content",
                                "tableStructure",
                                "summarySettings",
                                "showTax",
                              ]}
                              valuePropName="checked"
                              label="Tax"
                            >
                              <Switch />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              name={[
                                "content",
                                "tableStructure",
                                "summarySettings",
                                "showDiscount",
                              ]}
                              valuePropName="checked"
                              label="Discount"
                            >
                              <Switch />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              name={[
                                "content",
                                "tableStructure",
                                "summarySettings",
                                "showDues",
                              ]}
                              valuePropName="checked"
                              label="Dues"
                            >
                              <Switch />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              name={[
                                "content",
                                "tableStructure",
                                "summarySettings",
                                "wordsAmount",
                              ]}
                              valuePropName="checked"
                              label="Words"
                            >
                              <Switch />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    </div>
                  ),
                },
              ].filter(Boolean)}
            />
          </Form>
        ) : (
          <div style={{ textAlign: "center", marginTop: 100, color: "#ccc" }}>
            {loading ? <Spin /> : "Select a Template to Edit"}
          </div>
        )}
      </Col>
    </Row>
  );
};

export default TemplateEditor;
