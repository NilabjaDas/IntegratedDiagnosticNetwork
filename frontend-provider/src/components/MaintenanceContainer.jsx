import React, { useState, useEffect } from "react";
import moment from "moment";
import { Card, Typography, Space } from "antd";
import { ClockCircleOutlined, ToolOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

const MaintenanceContainer = ({
  activeStatus,
  startTime,      // e.g. "12:30 am, 03/03/2025"
  endTime,        // e.g. "04:30 am, 03/03/2025"
  updateInfo,     // e.g. "Crucial Upgrade"
  updateDescription // e.g. "Document upload feature"
}) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isOvertime, setIsOvertime] = useState(false);

  useEffect(() => {
    if (!activeStatus) return;

    // Parse the endTime string.
    const endMoment = moment(endTime, "hh:mm a, DD/MM/YYYY");

    const interval = setInterval(() => {
      const now = moment();
      const diff = endMoment.diff(now);

      if (diff > 0) {
        setIsOvertime(false);
        const duration = moment.duration(diff);
        const hours = Math.floor(duration.asHours());
        const minutes = Math.floor(duration.minutes());
        const seconds = Math.floor(duration.seconds());
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setIsOvertime(true);
        const overtime = moment.duration(now.diff(endMoment));
        const hours = Math.floor(overtime.asHours());
        const minutes = Math.floor(overtime.minutes());
        const seconds = Math.floor(overtime.seconds());
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeStatus, endTime]);

  if (!activeStatus) return null;

  return (
    <Card
      bordered={true}
      style={{
        backgroundColor: "#f5f5f5",
        textAlign: "center",
        maxWidth: 500,
        margin: "20px auto",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
      }}
      bodyStyle={{ padding: 24 }}
    >
      <Space direction="vertical" size="small" style={{ width: "100%" }}>

        {/* Icon */}
        <ToolOutlined style={{ fontSize: 50, color: "#FF5722" }} />

        {/* Title */}
        <Title level={3} style={{ margin: "8px 0 0 0", fontWeight: "bold" }}>
          Scheduled Maintenance
        </Title>

        {/* Subtitle / Update Info */}
        <Text strong style={{ fontSize: 16 }}>
          {updateInfo}
        </Text>

        {/* Description */}
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          {updateDescription}
        </Text>

        {/* Timer Section */}
        <Space align="center" style={{ marginTop: 8 }}>
          <ClockCircleOutlined style={{ fontSize: 20, color: "#555" }} />
          <Title level={5} style={{ margin: 0, color: isOvertime ? "#cf1322" : "#333" }}>
            {isOvertime ? "Overtime:" : "Ends in:"} {isOvertime ? `+${timeLeft}` : timeLeft}
          </Title>
        </Space>

      </Space>
    </Card>
  );
};

export default MaintenanceContainer;