import React from "react";
import { useParams, Navigate } from "react-router-dom";
import QueueManager from "../components/QueueManager/QueueManager";
import BlankPage from "./BlankPage";

const QueueManagerPage = () => {
  const { tab } = useParams();

  switch (tab) {
    case 'queue':
      return <QueueManager />;
    case 'reports':
      return <BlankPage title="Queue Reports" />;
    default:
      // Redirect invalid tabs safely back to the main manager
      return <Navigate to="/queue-management/queue" replace />;
  }
};

export default QueueManagerPage;