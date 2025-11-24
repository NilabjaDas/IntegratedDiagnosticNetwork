// reportGenerator.js
const moment = require("moment-timezone");
const getModel = require("../middleware/getModelsHandler");
const { getConnection } = require("../handlers/dbConnection");
const brandDatasSchema = require("../models/BrandDatas");
const statsSchema = require("../models/Stats");
const bookingsSchema = require("../models/Bookings");
const { sendEmailReport } = require("./emailHandler");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const ChartDataLabels = require("chartjs-plugin-datalabels");
const { Chart } = require("chart.js");
Chart.register(ChartDataLabels);
const puppeteer = require("puppeteer");
const CryptoJS = require("crypto-js");
const { decryptText, maskString } = require("./encryptionHandler");

const serverAddress = "https://server.saltstayz.ai/api";

const calculateBookingsData = async (connection, properties, currentDate) => {
  // currentDate should be in YYYY-MM-DD format.
  return await Promise.all(
    properties.map(async (property) => {
      // Use property-specific DB (assuming same approach as for stats)
      const propertyDb = connection.useDb(property.propertyId, {
        useCache: true,
      });
      const Bookings = getModel(propertyDb, "bookings", bookingsSchema); // ensure bookingsSchema is imported

      // Query: only bookings with checkInDate on currentDate.
      // Adjust query as per how your dates are stored (here assumed as Date type).
      const bookings = await Bookings.find({
        checkInDate: {
          $gte: new Date(currentDate + "T00:00:00.000Z"),
          $lte: new Date(currentDate + "T23:59:59.999Z"),
        },
      });

      let totalGuests = 0;
      let docsUploadedCount = 0;
      let totalAadhaarDocs = 0;

      bookings.forEach((booking) => {
        if (booking.roomList && Array.isArray(booking.roomList)) {
          booking.roomList.forEach((subBooking) => {
            if (subBooking.guestList && Array.isArray(subBooking.guestList)) {
              subBooking.guestList.forEach((guest) => {
                totalGuests++;
                if (guest.documentUploaded) {
                  docsUploadedCount++;
                  // Check if the uploaded document is AADHAAR.
                  if (
                    guest.guestDetails &&
                    guest.guestDetails.documents &&
                    Array.isArray(guest.guestDetails.documents) &&
                    guest.guestDetails.documents.length > 0 &&
                    guest.guestDetails.documents[0].docType === "AADHAAR"
                  ) {
                    totalAadhaarDocs++;
                  }
                }
              });
            }
          });
        }
      });

      return {
        propertyName: property.propertyName,
        totalGuests,
        docsUploadedCount,
        totalAadhaarDocs,
      };
    })
  );
};

const calculateAadhaarData = (statsResults, bookingsData) => {
  return statsResults.map((property) => {
    // If stats missing, return zeros.
    if (!property.stats || !property.stats.aadhaarScanData) {
      return {
        propertyName: property.propertyName,
        verified: 0,
        manual: 0,
        notDone: 0,
        failure: 0,
      };
    }
    if (!bookingsData) {
      return;
    }
    // Find the booking data for this property (matching by propertyName)
    const booking = bookingsData?.find(
      (b) => b.propertyName === property.propertyName
    );
    // Use the booking-scraped total AADHAAR docs if available; fallback to scanned count.
    const total = booking
      ? booking.totalAadhaarDocs
      : property.stats.aadhaarScanData.length;

    // Get counts from stats
    const verifiedCount = property.stats.aadhaarVerifiedData
      ? property.stats.aadhaarVerifiedData.length
      : 0;
    const manualCount = property.stats.aadhaarManualData
      ? property.stats.aadhaarManualData.length
      : 0;
    // "Not Done" is assumed as remaining out of the total (scanned vs (verified + manual))
    const notDoneCount = Math.max(total - (verifiedCount + manualCount), 0);
    const failureCount = property.stats.aadhaarFailureData
      ? property.stats.aadhaarFailureData.length
      : 0;

    // Calculate percentages
    const verifiedPct = total > 0 ? (verifiedCount / total) * 100 : 0;
    const manualPct = total > 0 ? (manualCount / total) * 100 : 0;
    const notDonePct = total > 0 ? (notDoneCount / total) * 100 : 0;
    const failurePct = total > 0 ? (failureCount / total) * 100 : 0;

    return {
      propertyName: property.propertyName,
      verified: parseFloat(verifiedPct.toFixed(2)),
      manual: parseFloat(manualPct.toFixed(2)),
      notDone: parseFloat(notDonePct.toFixed(2)),
      failure: parseFloat(failurePct.toFixed(2)),
    };
  });
};

function calculateAvgTimeForDocType(statsResults, docType) {
  let sum = 0;
  let count = 0;
  statsResults.forEach((result) => {
    if (result.stats && Array.isArray(result.stats.ocrSuccessData)) {
      result.stats.ocrSuccessData.forEach((item) => {
        if (
          item.docType &&
          item.docType.trim().toLowerCase() === docType.trim().toLowerCase() &&
          typeof item.timeTakenInSec === "number"
        ) {
          sum += item.timeTakenInSec;
          count++;
        }
      });
    }
  });
  return count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
}

const generatePdfReport = async (
  connection,
  brandName,
  properties,
  reportDate,
  currentTime
) => {
  try {
    // For each property, get the stats for the current date
    const statsResults = await Promise.all(
      properties.map(async (property) => {
        const propertyDb = connection.useDb(property.propertyId, {
          useCache: true,
        });
        const Stats = getModel(propertyDb, "stats", statsSchema);
        const stat = await Stats.findOne({ date: reportDate });
        let filteredStat = null;
        if (stat) {
          const { _id, __v, createdAt, updatedAt, ...rest } = stat._doc;
          filteredStat = rest;
        }
        return {
          propertyId: property.propertyId,
          propertyName: property.propertyName,
          domain: property.domain,
          stats: filteredStat,
        };
      })
    );

    // After retrieving 'properties' and setting 'reportDate'
    const bookingsData = await calculateBookingsData(
      connection,
      properties,
      reportDate
    );

    // Aggregate document type counts across all properties
    let totalAadhaar = 0,
      totalDL = 0,
      totalPassport = 0,
      totalVoter = 0;
    // For property comparison chart data
    let propertyLabels = [];
    let propertyProcessedPct = [];
    statsResults.forEach((result) => {
      if (result.stats) {
        totalAadhaar += result.stats.aadhaarScanData
          ? result.stats.aadhaarScanData.length
          : 0;
        totalDL += result.stats.DLScanData ? result.stats.DLScanData.length : 0;
        totalPassport += result.stats.passportScanData
          ? result.stats.passportScanData.length
          : 0;
        totalVoter += result.stats.voterScanData
          ? result.stats.voterScanData.length
          : 0;

        const totalArrivals = result.stats.arrivalsData
          ? result.stats.arrivalsData.length
          : 0;
        const checkinProcessed = result.stats.checkInProcessedData
          ? result.stats.checkInProcessedData.filter(
              (item) => item.checkInDate === reportDate
            ).length
          : 0;

        const pct = totalArrivals
          ? (checkinProcessed / totalArrivals) * 100
          : 0;
        propertyLabels.push(result.propertyName);
        propertyProcessedPct.push(parseFloat(pct.toFixed(2)));
      }
    });

    // Helper function to create a gradient for a failure bar.
    // Here, lower failure value produces a lighter red and higher produces a deeper red.
    function createFailureGradient(ctx, chartArea, failureValue) {
      // Compute a ratio based on failureValue relative to a maximum (assumed 100 here).
      const maxFailure = 100;
      const ratio = Math.min(1, failureValue / maxFailure);
      // Create a horizontal gradient from left to right.
      const gradient = ctx.createLinearGradient(
        chartArea.left,
        0,
        chartArea.right,
        0
      );
      // From 0 to 30% it stays at light red, then transitions to deep red.
      gradient.addColorStop(0, "rgb(255, 214, 111)"); // very light red
      gradient.addColorStop(0.15, "rgb(255, 214, 111)"); // remain light until 30%
      gradient.addColorStop(0.5, "rgb(255, 0, 0)"); // deep red at 100%
      return gradient;
    }

    // Helper function to create a gradient for an average time bar.
    // Lower average time is green, higher is yellow.
    function createAvgTimeGradient(ctx, chartArea, avgTime) {
      // Assume minTime = 5 sec and maxTime = 20 sec
      const minTime = 5;
      const maxTime = 30;
      const ratio = Math.min(
        1,
        Math.max(0, (avgTime - minTime) / (maxTime - minTime))
      );
      const gradient = ctx.createLinearGradient(
        chartArea.left,
        0,
        chartArea.right,
        0
      );
      // For instance, start at green (rgb(76,175,80)) and end at yellow (rgb(255,235,59))
      gradient.addColorStop(0, "rgb(76,175,80)");
      gradient.addColorStop(0.3, "rgb(255,235,59)");
      gradient.addColorStop(0.7, "rgb(229, 95, 42)");
      gradient.addColorStop(1, "rgb(229, 95, 42)");
      return gradient;
    }

    function createCheckinGradient(ctx, chartArea) {
      // Create a horizontal gradient from left to right.
      const gradient = ctx.createLinearGradient(
        chartArea.left,
        0,
        chartArea.right,
        0
      );
      // From 0 to 30% it stays at light red, then transitions to deep red.
      gradient.addColorStop(0, "rgb(234, 79, 79)"); // very light red
      gradient.addColorStop(0.3, "rgb(236, 179, 33)"); // remain light until 30%
      gradient.addColorStop(0.5, "rgb(19, 101, 0)"); // deep red at 100%
      return gradient;
    }

    function getSuccessfulScanCount(statsResults, docType) {
      let count = 0;
      statsResults.forEach((result) => {
        if (result.stats && Array.isArray(result.stats.scansData)) {
          result.stats.scansData.forEach((item) => {
            if (
              item.docType &&
              item.docType.trim().toLowerCase() ===
                docType.trim().toLowerCase() &&
              item.scanned === true // only count successful scans
            ) {
              count++;
            }
          });
        }
      });
      return count;
    }

    // Existing function for failure count from ocrFailureData remains the same
    function getOcrFailureCount(statsResults, docType) {
      let count = 0;
      statsResults.forEach((result) => {
        if (result.stats && Array.isArray(result.stats.ocrFailureData)) {
          result.stats.ocrFailureData.forEach((item) => {
            if (
              item.docType &&
              item.docType.trim().toLowerCase() === docType.trim().toLowerCase()
            ) {
              count++;
            }
          });
        }
      });
      return count;
    }

    const docTypes = ["AADHAAR", "DRIVING_LICENSE", "PASSPORT", "VOTERID"];

    const docTypesData = docTypes.map((docType) => {
      // Count failures from ocrFailureData
      const failureCount = getOcrFailureCount(statsResults, docType);
      // Count successful scans from scansData where scanned === true
      const successCount = getSuccessfulScanCount(statsResults, docType);
      // Total scans = successes + failures
      const total = failureCount + successCount;
      // Calculate percentage (if total > 0)
      const pct = total > 0 ? (failureCount / total) * 100 : 0;
      return { docType, failureCount, total, pct };
    });

    // Extract percentages for the chart data
    const failurePercentages = docTypesData.map((d) => d.pct);

    const avgTimeAadhaar = calculateAvgTimeForDocType(statsResults, "AADHAAR");
    const avgTimeDL = calculateAvgTimeForDocType(
      statsResults,
      "DRIVING_LICENSE"
    );
    const avgTimePassport = calculateAvgTimeForDocType(
      statsResults,
      "PASSPORT"
    );
    const avgTimeVoter = calculateAvgTimeForDocType(statsResults, "VOTERID");

    const averageTimes = [
      avgTimeAadhaar,
      avgTimeDL,
      avgTimePassport,
      avgTimeVoter,
    ];

    const propertyFailurePercents = [];
    const propertyLabelsFiltered = [];

    statsResults.forEach((result) => {
      if (
        result.stats &&
        Array.isArray(result.stats.ocrFailureData) &&
        Array.isArray(result.stats.ocrSuccessData)
      ) {
        const failureCount = result.stats.ocrFailureData.length;
        const successCount = result.stats.ocrSuccessData.length;
        const totalScans = failureCount + successCount;
        const percentFailure = totalScans
          ? (failureCount / totalScans) * 100
          : 0;
        propertyFailurePercents.push(percentFailure);
        propertyLabelsFiltered.push(result.propertyName);
      }
    });
    // 1. Compute scanned vs. uploaded percentages per property
    const scanData = statsResults.map((property) => {
      let total = 0,
        scanned = 0,
        uploaded = 0;
      if (property.stats && property.stats.scansData) {
        total = property.stats.scansData.length;
        scanned = property.stats.scansData.filter(
          (scan) => scan.scanned === true
        ).length;
        uploaded = total - scanned;
      }
      const scannedPct = total > 0 ? (scanned / total) * 100 : 0;
      const uploadedPct = total > 0 ? (uploaded / total) * 100 : 0;
      return {
        propertyName: property.propertyName,
        scannedPct: parseFloat(scannedPct.toFixed(2)),
        uploadedPct: parseFloat(uploadedPct.toFixed(2)),
      };
    });

    // Generate Document Type Share chart configuration (horizontal bar chart)
    const dataValues = [totalAadhaar, totalDL, totalPassport, totalVoter];
    const dynamicMax = Math.ceil((Math.max(...dataValues) + 20) / 10) * 10;

    const docTypeChartConfig = {
      type: "bar",
      data: {
        labels: ["Aadhaar Card", "Driving License", "Passport", "Voter ID"],
        datasets: [
          {
            label: "Number of Uploads",
            data: [totalAadhaar, totalDL, totalPassport, totalVoter],
            backgroundColor: ["#4e73df", "#1cc88a", "#36b9cc", "#f6c23e"],
            barThickness: 10,
            categoryPercentage: 1, // occupy full category height
            barPercentage: 1, // no extra spacing between bars
          },
        ],
      },
      options: {
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: "end",
            align: "end",
            // formatter: value => `${value} sec`,
            color: "black",
            font: { size: 12 },
            offset: 4,
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            max: dynamicMax,
          },
          y: {
            grid: {
              display: false,
            },
          },
        },
      },
    };

    // Generate Property Comparison chart configuration (horizontal bar chart)
    const propertyChartConfig = {
      type: "bar",
      data: {
        labels: propertyLabels,
        datasets: [
          {
            label: "Check-In Processed (%)",
            data: propertyProcessedPct,
            backgroundColor: (context) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return null;
              return createCheckinGradient(ctx, chartArea);
            },
            barThickness: 12,
            categoryPercentage: 1,
            barPercentage: 1,
          },
        ],
      },
      options: {
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: "end",
            align: "end",
            formatter: (value, context) => `${value.toFixed(1)}%`,
            color: (context) => {
              const value = context.dataset.data[context.dataIndex];
              return value < 10 ? "black" : "white";
            },
            font: (context) => {
              const value = context.dataset.data[context.dataIndex];
              return value < 10 ? { size: 12 } : { size: 12, weight: "bold" };
            },
            offset: (context) => {
              const value = context.dataset.data[context.dataIndex];
              return value < 10 ? 5 : -53;
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            grid: {
              display: false,
            },
          },
          y: {
            grid: {
              display: false,
            },
          },
        },
      },
    };

    // (A) Graph 1: Guests vs Documents Uploaded per Property (from bookings)
    const guestsChartConfig = {
      type: "bar",
      data: {
        labels: bookingsData.map((b) => b.propertyName),
        datasets: [
          {
            label: "Total Guests",
            data: bookingsData.map((b) => b.totalGuests),
            backgroundColor: "#4e73df",
          },
          {
            label: "Documents Uploaded",
            data: bookingsData.map((b) => b.docsUploadedCount),
            backgroundColor: "#1cc88a",
          },
        ],
      },
      options: {
        indexAxis: "y", // horizontal bars
        plugins: {
          legend: { display: true },
          datalabels: {
            display: false, // disable values on bars
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { display: false },
          },
          y: {
            grid: { display: false },
          },
        },
      },
    };

    // (B) Graph 2: Aadhaar Comparison Chart per Property
    const aadhaarData = calculateAadhaarData(statsResults, bookingsData);

    const aadhaarChartConfig = {
      type: "bar",
      data: {
        labels: aadhaarData.map((p) => p.propertyName),
        datasets: [
          {
            label: "Verified %",
            data: aadhaarData.map((p) => p.verified),
            backgroundColor: "#4caf50",
            stack: "stack1",
          },
          {
            label: "Manual %",
            data: aadhaarData.map((p) => p.manual),
            backgroundColor: "#ff9800",
            stack: "stack1",
          },
          {
            label: "Not Done %",
            data: aadhaarData.map((p) => p.notDone),
            backgroundColor: "#9e9e9e",
            stack: "stack1",
          },
          {
            // type: 'line',
            label: "Failure %",
            data: aadhaarData.map((p) => p.failure),
            backgroundColor: "#db2602",
            // stack: 'stack1'
          },
        ],
      },
      options: {
        indexAxis: "y", // horizontal bars
        plugins: {
          legend: { display: true },
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            stacked: true,
            grid: {
              display: false,
            },
          },
          y: {
            stacked: true,
            grid: {
              display: false,
            },
          },
        },
      },
    };

    const ocrFailureChartConfig = {
      type: "bar",
      data: {
        labels: ["Aadhaar", "Driving License", "Passport", "Voter ID"],
        datasets: [
          {
            label: "OCR Failure Percentage (Failed / Total Scans)",
            data: failurePercentages,
            backgroundColor: (context) => {
              const index = context.dataIndex;
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return null; // Chart not ready
              const value = failurePercentages[index];
              return createFailureGradient(ctx, chartArea, value);
            },
            barThickness: 10,
            categoryPercentage: 1,
            barPercentage: 1,
          },
        ],
      },
      options: {
        indexAxis: "y", // horizontal bars
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: "end",
            align: "end",
            formatter: (value, context) => {
              const index = context.dataIndex;
              const doc = docTypesData[index];
              // Display percentage along with (failures/total)
              return `${value.toFixed(1)}% (${doc.failureCount}/${doc.total})`;
            },
            color: "black",
            font: { size: 12 },
            offset: 4,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100, // force x-axis to be 0 to 100%
            grid: { display: false },
            ticks: {
              callback: function (value) {
                return `${value}%`;
              },
            },
          },
          y: {
            grid: { display: false },
          },
        },
      },
    };

    // Average Success Time Chart Configuration (Horizontal Bar)
    const avgTimeChartConfigDataValues = averageTimes;
    const dynamicValue = Math.max(...avgTimeChartConfigDataValues) + 2;
    const avgTimeChartConfigDynamicMax = Math.ceil(dynamicValue / 2) * 2;

    const avgTimeChartConfig = {
      type: "bar",
      data: {
        labels: ["Aadhaar", "Driving License", "Passport", "Voter ID"],
        datasets: [
          {
            label: "Avg Time (sec)",
            // averageTimes: an array with the average success time for each document type.
            data: averageTimes,
            backgroundColor: (context) => {
              const index = context.dataIndex;
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return null;
              const value = averageTimes[index];
              return createAvgTimeGradient(ctx, chartArea, value);
            },
            barThickness: 10,
            categoryPercentage: 1,
            barPercentage: 1,
          },
        ],
      },
      options: {
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: "end",
            align: "end",
            formatter: (value) => `${value} sec`,
            color: "black",
            font: { size: 12 },
            offset: 4,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { display: false },
            max: avgTimeChartConfigDynamicMax,
          },
          y: {
            grid: { display: false },
          },
        },
      },
    };

    const propertyFailurePercentsDataValues = propertyFailurePercents;
    const propertyFailurePercentsDynamicMax =
      Math.ceil((Math.max(...propertyFailurePercentsDataValues) + 10) / 10) *
      10;

    const propertyFailureChartConfig = {
      type: "bar",
      data: {
        labels: propertyLabelsFiltered, // use the filtered labels
        datasets: [
          {
            label: "OCR Failure Percentage",
            data: propertyFailurePercents,
            backgroundColor: (context) => {
              const index = context.dataIndex;
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return null; // Chart not ready
              const value = propertyFailurePercents[index];
              return createFailureGradient(ctx, chartArea, value);
            },
            barThickness: 10,
            categoryPercentage: 1,
            barPercentage: 1,
          },
        ],
      },
      options: {
        indexAxis: "y", // horizontal bars
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: "end",
            align: "end",
            formatter: (value) => `${value.toFixed(1)}%`,
            color: "black",
            font: { size: 12 },
            offset: 4,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { display: false },
            max: propertyFailurePercentsDynamicMax,
          },
          y: {
            grid: { display: false },
          },
        },
      },
    };

    const scannedVsUploadedChartConfig = {
      type: "bar",
      data: {
        labels: scanData.map((item) => item.propertyName),
        datasets: [
          {
            label: "Scanned %",
            data: scanData.map((item) => item.scannedPct),
            backgroundColor: "#2896D7", // Green for scanned
            stack: "stack1",
            barThickness: 10,
          },
          {
            label: "Uploaded %",
            data: scanData.map((item) => item.uploadedPct),
            backgroundColor: "#7510EF", // Red for uploaded
            stack: "stack1",
            barThickness: 10,
          },
        ],
      },
      options: {
        indexAxis: "y", // horizontal bars
        plugins: {
          legend: { display: true },
          datalabels: {
            anchor: "end",
            align: "end",
            formatter: (value) => `${value.toFixed(1)}%`,
            color: "black",
            font: { size: 12 },
            offset: 4,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            stacked: true,
            grid: { display: false },
            ticks: {
              callback: (value) => `${value}%`,
            },
          },
          y: {
            stacked: true,
            grid: { display: false },
          },
        },
      },
    };

    const guestsCategoryHeight = 30; // per property
    const guestsExtraPadding = 10; // extra padding
    const dynamicGuestsHeight =
      bookingsData.length * guestsCategoryHeight + guestsExtraPadding;
    const chartCanvasGuests = new ChartJSNodeCanvas({
      width: 800,
      height: dynamicGuestsHeight,
    });
    const guestsChartImage = await chartCanvasGuests.renderToDataURL(
      guestsChartConfig
    );

    // For Document Type Share chart
    const docTypeCategoryHeight = 30; // height per label
    const docTypeExtraPadding = 10; // extra padding for titles/margins
    const dynamicDocTypeHeight =
      docTypeChartConfig.data.labels.length * docTypeCategoryHeight +
      docTypeExtraPadding;
    const chartCanvasDocType = new ChartJSNodeCanvas({
      width: 800,
      height: dynamicDocTypeHeight,
      plugins: {
        modern: ["chartjs-plugin-datalabels"],
      },
    });
    const docTypeChartImage = await chartCanvasDocType.renderToDataURL(
      docTypeChartConfig
    );

    // For Property Comparison chart
    const propertyCategoryHeight = 30; // height per property label
    const propertyExtraPadding = 10; // extra padding for titles/margins
    const dynamicPropertyHeight =
      propertyLabels.length * propertyCategoryHeight + propertyExtraPadding;
    const chartCanvasProperty = new ChartJSNodeCanvas({
      width: 800,
      height: dynamicPropertyHeight,
      plugins: {
        modern: ["chartjs-plugin-datalabels"],
      },
    });
    const propertyChartImage = await chartCanvasProperty.renderToDataURL(
      propertyChartConfig
    );

    // Calculate dynamic height for the Aadhaar chart (1 label + extra padding)
    const aadhaarCategoryHeight = 30; // height per label (only one here)
    const aadhaarExtraPadding = 10; // extra padding for titles/margins
    const dynamicAadhaarHeight =
      aadhaarData.length * aadhaarCategoryHeight + aadhaarExtraPadding;
    const chartCanvasAadhaar = new ChartJSNodeCanvas({
      width: 800,
      height: dynamicAadhaarHeight,
    });
    const aadhaarChartImage = await chartCanvasAadhaar.renderToDataURL(
      aadhaarChartConfig
    );

    const failureCategoryHeight = 30;
    const failureExtraPadding = 10;
    const dynamicFailureHeight =
      ocrFailureChartConfig.data.labels.length * failureCategoryHeight +
      failureExtraPadding;
    const chartCanvasFailure = new ChartJSNodeCanvas({
      width: 800,
      height: dynamicFailureHeight,
      plugins: {
        modern: ["chartjs-plugin-datalabels"],
      },
    });
    const failureChartImage = await chartCanvasFailure.renderToDataURL(
      ocrFailureChartConfig
    );

    const avgTimeCategoryHeight = 30;
    const avgTimeExtraPadding = 10;
    const dynamicAvgTimeHeight =
      avgTimeChartConfig.data.labels.length * avgTimeCategoryHeight +
      avgTimeExtraPadding;
    const chartCanvasAvgTime = new ChartJSNodeCanvas({
      width: 800,
      height: dynamicAvgTimeHeight,
      plugins: {
        modern: ["chartjs-plugin-datalabels"],
      },
    });
    const avgTimeChartImage = await chartCanvasAvgTime.renderToDataURL(
      avgTimeChartConfig
    );

    // Calculate dynamic height for the chart
    const propertyFailureCategoryHeight = 30; // height per property label
    const propertyFailureExtraPadding = 10; // extra padding for titles/margins
    const dynamicPropertyFailureHeight =
      propertyLabels.length * propertyFailureCategoryHeight +
      propertyFailureExtraPadding;
    const chartCanvasPropertyFailure = new ChartJSNodeCanvas({
      width: 800,
      height: dynamicPropertyFailureHeight,
      plugins: {
        modern: ["chartjs-plugin-datalabels"],
      },
    });
    const propertyFailureChartImage =
      await chartCanvasPropertyFailure.renderToDataURL(
        propertyFailureChartConfig
      );

    // 3. Dynamically calculate the canvas height for the chart (one bar per property)
    const categoryHeight = 30; // height per property label
    const extraPadding = 10; // extra padding for margins
    const dynamicScanChartHeight =
      scanData.length * categoryHeight + extraPadding;
    const chartCanvasScan = new ChartJSNodeCanvas({
      width: 800,
      height: dynamicScanChartHeight,
    });
    const scannedVsUploadedChartImage = await chartCanvasScan.renderToDataURL(
      scannedVsUploadedChartConfig
    );

    // Helper function to generate an HTML table from an array of objects.

    const generateArrivalsTable = (
      arrivalsData,
      checkInProcessedData,
      columns,
      options = {}
    ) => {
      let html = `<div class="section"><h3 style="font-size: 14px; margin-bottom: 8px;">Arrivals Details</h3>`;
      if (!arrivalsData || arrivalsData.length === 0) {
        html += `<p style="font-size: 12px;">No arrivals available.</p></div>`;
        return html;
      }

      const processedBookingIds = new Set(
        checkInProcessedData && Array.isArray(checkInProcessedData)
          ? checkInProcessedData.map((item) => item.bookingId)
          : []
      );

      const bookingInfoMap = new Map();
      if (checkInProcessedData && Array.isArray(checkInProcessedData)) {
        checkInProcessedData.forEach((item) => {
          if (item.bookingId && item.bookingData) {
            bookingInfoMap.set(item.bookingId, item.bookingData);
          }
        });
      }

      html += `<table style="font-size: 12px; border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th style="padding: 4px; border: 1px solid #ccc;">Sl No</th>`;
      columns.forEach((col) => {
        let title = col
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase());
        html += `<th style="padding: 4px; border: 1px solid #ccc;">${title}</th>`;
      });
      html += `</tr>
        </thead>
        <tbody>`;

      arrivalsData.forEach((item, index) => {
        const rowStyle = processedBookingIds.has(item.bookingId)
          ? ' style="background-color: #d4edda;"'
          : "";

        html += `<tr${rowStyle}>`;
        html += `<td style="padding: 4px; border: 1px solid #ccc;">${
          index + 1
        }</td>`;

        columns.forEach((col) => {
          let value = item[col];

          if (col === "checkInDate" || col === "checkOutDate") {
            if (value) {
              value = moment(value).format("DD/MM/YYYY");
            }
          } else if (col === "checkinTime") {
            const bookingData = bookingInfoMap.get(item.bookingId);
            if (bookingData) {
              let checkinTimeFormatted = "";

              // Check if partial check-in is true and details exist.
              if (
                bookingData.partialCheckin === true &&
                Array.isArray(bookingData.partialCheckinDetails) &&
                bookingData.partialCheckinDetails.length > 0
              ) {
                const detail = bookingData.partialCheckinDetails.find(
                  (d) => d.partialCheckinSubBookingId === item.bookingId
                );
                if (detail && detail.checkinTime) {
                  checkinTimeFormatted = `${moment(detail.checkinTime).format(
                    "DD/MM/YYYY, hh:mm a"
                  )} | Partial Check-in`;
                }
              }
              // Else check if force check-in status is true and details exist.
              else if (
                bookingData.forceCheckinStatus === true &&
                Array.isArray(bookingData.forceCheckinDetails) &&
                bookingData.forceCheckinDetails.length > 0
              ) {
                const detail = bookingData.forceCheckinDetails.find(
                  (d) => d.subBookingId === item.bookingId
                );
                if (detail && detail.checkinTime) {
                  checkinTimeFormatted = `${moment(detail.checkinTime).format(
                    "DD/MM/YYYY, hh:mm a"
                  )} | Force Check-in`;
                }
              }
              // Fallback: Use bookingData.checkinTime if available.
              else if (bookingData.checkinTime) {
                checkinTimeFormatted = moment(bookingData.checkinTime).format(
                  "DD/MM/YYYY, hh:mm a"
                );
              }

              value = checkinTimeFormatted;
            } else {
              value = "";
            }
          }

          html += `<td style="padding: 4px; border: 1px solid #ccc;">${
            value !== undefined ? value : ""
          }</td>`;
        });
        html += `</tr>`;
      });

      html += `</tbody></table></div>`;
      return html;
    };

    const generateAdditionalCheckinsTable = (
      arrivalsData,
      checkInProcessedData,
      columns,
      options = {}
    ) => {
      // Create a set of bookingIds from arrivalsData
      const arrivalsIds = new Set(arrivalsData.map((item) => item.bookingId));

      // Filter checkInProcessedData to get additional check-ins (those not in arrivalsIds)
      const additionalCheckins = checkInProcessedData.filter(
        (item) => !arrivalsIds.has(item.bookingId)
      );

      if (!additionalCheckins.length) {
        return ""; // Return empty string if no additional check-ins exist
      }

      let html = `<div class="section"><h3 style="font-size: 14px; margin-bottom: 8px;">Additional Check-ins</h3>`;
      html += `<table style="font-size: 12px; border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th style="padding: 4px; border: 1px solid #ccc;">Sl No</th>`;
      columns.forEach((col) => {
        let title = col
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase());
        html += `<th style="padding: 4px; border: 1px solid #ccc;">${title}</th>`;
      });
      html += `</tr>
        </thead>
        <tbody>`;

      const bookingInfoMap = new Map();
      if (checkInProcessedData && Array.isArray(checkInProcessedData)) {
        checkInProcessedData.forEach((item) => {
          if (item.bookingId && item.bookingData) {
            bookingInfoMap.set(item.bookingId, item.bookingData);
          }
        });
      }

      additionalCheckins.forEach((item, index) => {
        const rowStyle = ' style="background-color: #d4edda;"';

        html += `<tr${rowStyle}>`;
        html += `<td style="padding: 4px; border: 1px solid #ccc;">${
          index + 1
        }</td>`;
        columns.forEach((col) => {
          let value = item[col];
          if ((col === "checkInDate" || col === "checkOutDate") && value) {
            value = moment(value).format("DD/MM/YYYY");
          } else if (col === "checkinTime") {
            const bookingData = bookingInfoMap.get(item.bookingId);
            if (bookingData) {
              if (bookingData.partialCheckin === true) {
                value = "Partially Checked-in";
              } else if (
                bookingData.forceCheckinDetails &&
                bookingData.forceCheckinDetails.length > 0
              ) {
                value = "Force Checked-in";
              } else if (bookingData.checkinTime) {
                value = moment(bookingData.checkinTime).format(
                  "DD/MM/YYYY, hh:mm a"
                );
              } else {
                value = "";
              }
            } else {
              value = "";
            }
          }
          html += `<td style="padding: 4px; border: 1px solid #ccc;">${
            value !== undefined ? value : ""
          }</td>`;
        });
        html += `</tr>`;
      });

      html += `</tbody></table></div>`;
      return html;
    };

    const generateTable = (heading, dataArray, columns, options = {}) => {
      let html = `<div class="section"><h3 style="font-size: 14px; margin-bottom: 8px;">${heading}</h3>`;
      if (!dataArray || dataArray.length === 0) {
        html += `<p style="font-size: 12px;">No data available for ${heading.toLowerCase()}.</p></div>`;
        return html;
      }
      html += `<table style="font-size: 12px; border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th style="padding: 4px; border: 1px solid #ccc;">Sl No</th>`;
      // Table headers (convert key to Title Case)
      columns.forEach((col) => {
        let title = col;
        if (col === "failureReason") {
          title = "Failure Reason";
        } else if (col === "scanned") {
          title = "Mode of Upload";
        } else if (col === "bookingId") {
          title = "Booking ID";
        } else if (col === "docType") {
          title = "Document Type";
        } else if (col === "docNumber") {
          title = "Masked Document ID";
        } else {
          title = col
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase());
        }
        html += `<th style="padding: 4px; border: 1px solid #ccc;">${title}</th>`;
      });
      html += `</tr>
        </thead>
        <tbody>`;
      // Table rows
      dataArray.forEach((item, index) => {
        html += `<tr>
          <td style="padding: 4px; border: 1px solid #ccc;">${index + 1}</td>`;
        columns.forEach((col) => {
          let value = item[col];
          if (col === "failureReason") {
            value =
              item.data && item.data.failure_reason
                ? item.data.failure_reason
                : "";
          }
          if (col === "verifiedAt" && value) {
            value = moment(value).format("DD/MM/YYYY, hh:mm a");
          }
          // if (col === "docNumber" && value) {
          //   value = decryptText(value)
          //   value = maskString(value)
          // }
          if (col === "guestName") {
            value = ["false", false].includes(value) ? "--NA--" : value;
          }
          if (col === "scanned") {
            value = value ? "Scanned" : "Admin";
          }
          if (["documentImageFront", "documentImageBack"].includes(col)) {
            value = "";
          }
          if (
            options.innerTable &&
            col === "data" &&
            value &&
            typeof value === "object"
          ) {
            let innerHtml = `<table>`;
            Object.entries(value).forEach(([key, val]) => {
              innerHtml += `<tr><td><strong>${key}</strong></td><td>${val}</td></tr>`;
            });
            innerHtml += `</table>`;
            value = innerHtml;
          } else {
            if (typeof value === "object" && value !== null) {
              value = JSON.stringify(value);
            }
          }
          html += `<td style="padding: 4px; border: 1px solid #ccc;">${
            value !== undefined ? value : ""
          }</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table></div>`;
      return html;
    };

    const generateOcrFailureTable = (
      heading,
      dataArray,
      columns,
      propertyName = {}
    ) => {
      let html = `<div class="section"><h3 style="font-size: 14px; margin-bottom: 8px;">${heading}</h3>`;
      if (!dataArray || dataArray.length === 0) {
        html += `<p style="font-size: 12px;">No data available for ${heading.toLowerCase()}.</p></div>`;
        return html;
      }
      html += `<table style="font-size: 12px; border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th style="padding: 4px; border: 1px solid #ccc;">Sl No</th>`;
      // Table headers
      columns.forEach((col) => {
        let title = col;
        if (col === "docImageFront") {
          title = "Front Image";
        } else if (col === "docImageBack") {
          title = "Back Image";
        } else if (col === "docType") {
          title = "Document Type";
        } else if (col === "timeTakenInSec") {
          title = "Time (sec)";
        } else {
          title = col
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase());
        }
        html += `<th style="padding: 4px; border: 1px solid #ccc;">${title}</th>`;
      });
      html += `</tr>
        </thead>
        <tbody>`;
      // Table rows
      dataArray.forEach((item, index) => {
        html += `<tr>
          <td style="padding: 4px; border: 1px solid #ccc;">${index + 1}</td>`;
        columns.forEach((col) => {
          let value = item[col];

          // Special handling for document image columns
          if (col === "docImageFront") {
            if (value) {
              try {
                // Convert data to string and encrypt
                const stringifiedData = JSON.stringify({ value, propertyName });
                const encryptedData = CryptoJS.AES.encrypt(
                  stringifiedData,
                  process.env.AES_SEC
                ).toString();
                const safeEncryptedUrl = encodeURIComponent(encryptedData);
                value = `<a href="${process.env.SERVER_ADDRESS}/admin/rejected-document-view/?encryptedUrl=${safeEncryptedUrl}" target="_blank">View Image</a>`;
              } catch (error) {
                console.error("Error encrypting image url", error);
              }
            } else {
              value = "";
            }
          }
          if (col === "docImageBack") {
            if (value) {
              try {
                // Convert data to string and encrypt
                const stringifiedData = JSON.stringify({ value, propertyName });
                const encryptedData = CryptoJS.AES.encrypt(
                  stringifiedData,
                  process.env.AES_SEC
                ).toString();
                const safeEncryptedUrl = encodeURIComponent(encryptedData);
                value = `<a href="${serverAddress}/admin/rejected-document-view/?encryptedUrl=${safeEncryptedUrl}" target="_blank">View Image</a>`;
              } catch (error) {
                console.error("Error encrypting image url", error);
              }
            } else {
              value = "";
            }
          }
          // if (col === "docNumber" && value) {
          //   value = decryptText(value)
          //   value = maskString(value)
          // }
          if (col === "guestName") {
            value = ["false", false].includes(value) ? "--NA--" : value;
          }
          if (col === "reason") {
            value = `<p style="font-size: 10px; width: 8rem;">${value}</p>`;
          }

          html += `<td style="padding: 4px; border: 1px solid #ccc;">${
            value !== undefined ? value : ""
          }</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table></div>`;
      return html;
    };

    // Build HTML for the report
    let htmlContent = `
      <html>
      <head>
       <meta charset="UTF-8">
        <title>Property Concise Report ${reportDate}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2, h3 { color: #333; }
          .property { 
  border: 1px solid #ddd; 
  border-radius: 8px; 
  padding: 16px; 
  margin-bottom: 20px; 
  box-shadow: 2px 2px 12px rgba(0,0,0,0.1);
  page-break-after: always;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

          .property h2 { margin: 0 0 10px; color: #0056b3; }
          .stats-table, table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .stats-table th, .stats-table td, table th, table td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          .stats-table th, table th { background-color: #e9e9e9; }
          .section { margin-top: 12px; page-break-inside: avoid; }
          .chart-section { margin-top: 12px; text-align: center; page-break-inside: avoid; }
        </style>
      </head>
      <body>
    `;

    // Insert the two chart sections at the top of the report
    htmlContent += `
    
      <div class="chart-section">
        <h3>Check-In Processed % (Property-wise)</h3>
        <img src="${propertyChartImage}" alt="Property Comparison Chart" style="max-width:100%; height:auto;" />
      </div>
       <div class="chart-section">
    <h3>Guests vs Documents Uploaded (Property-wise)</h3>
    <img src="${guestsChartImage}" alt="Guests vs Documents Chart" style="max-width:100%; height:auto;" />
  </div>
   <div class="chart-section">
    <h3>Aadhaar Card Verifications (Property-wise)</h3>
    <img src="${aadhaarChartImage}" alt="Aadhaar Comparison Chart" style="max-width:100%; height:auto;" />
  </div>
   <div class="chart-section">
    <h3>Scan vs Uploads % (Property-wise)</h3>
    <img src="${scannedVsUploadedChartImage}" alt="Property Failure Counts Chart" style="max-width:100%; height:auto;" />
  </div>
   <div class="chart-section">
    <h3>Scanning Failure % (Property-wise)</h3>
    <img src="${propertyFailureChartImage}" alt="Property Failure Counts Chart" style="max-width:100%; height:auto;" />
  </div>
    <div class="chart-section">
        <h3>Types of Document Uploaded</h3>
        <img src="${docTypeChartImage}" alt="Document Type Share Chart" style="max-width:100%; height:auto;" />
      </div>
       <div class="chart-section">
    <h3>Average Processing Time (sec)</h3>
    <img src="${avgTimeChartImage}" alt="Average Success Time Chart" style="max-width:100%; height:auto;" />
  </div>
        <div class="chart-section">
    <h3>Document Failure Rate</h3>
    <img src="${failureChartImage}" alt="Document Failure Chart" style="max-width:100%; height:auto;" />
  </div>
   

   
 
    `;

    htmlContent += `<div style="page-break-before: always;"></div>`;

    // Loop through each property to include individual stats
    statsResults.forEach((result) => {
      htmlContent += `
        <div class="property">
          <table style="width: 100%; border-style: hidden;">
            <thead style="display: table-header-group;">
              <tr>
                <td style="font-size: 16px; font-weight: bold; color: #0056b3; border-bottom: 1px solid #ddd; padding: 4px;">
                  ${result.propertyName}
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
      `;
      if (result.stats) {
        const totalArrivals = result.stats.arrivalsData
          ? result.stats.arrivalsData.length
          : 0;
        const checkinProcessed = result.stats.checkInProcessedData
          ? result.stats.checkInProcessedData.filter(
              (item) => item.checkInDate === reportDate
            ).length
          : 0;
        const aadhaarScanned = result.stats.aadhaarScanData
          ? result.stats.aadhaarScanData.length
          : 0;
        const dlScanned = result.stats.DLScanData
          ? result.stats.DLScanData.length
          : 0;
        const passportScanned = result.stats.passportScanData
          ? result.stats.passportScanData.length
          : 0;
        const voterScanned = result.stats.voterScanData
          ? result.stats.voterScanData.length
          : 0;
        const totalScans = result.stats.scansData
          ? result.stats.scansData.length
          : 0;
        const scanningIssues = result.stats.scanningIssueData
          ? result.stats.scanningIssueData.length
          : 0;
        const aadhaarVerified = result.stats.aadhaarVerifiedData
          ? result.stats.aadhaarVerifiedData.length
          : 0;
        const manualAadhaar = result.stats.aadhaarManualData
          ? result.stats.aadhaarManualData.length
          : 0;
        const aadhaarFailed = result.stats.aadhaarFailureData
          ? result.stats.aadhaarFailureData.length
          : 0;

        let topFailureReason = "N/A";
        if (
          result.stats.aadhaarFailureData &&
          result.stats.aadhaarFailureData.length > 0
        ) {
          const failureCount = {};
          result.stats.aadhaarFailureData.forEach((item) => {
            const reason =
              item.data && item.data.failure_reason
                ? item.data.failure_reason
                : "Unknown";
            failureCount[reason] = (failureCount[reason] || 0) + 1;
          });
          const sorted = Object.entries(failureCount).sort(
            (a, b) => b[1] - a[1]
          );
          topFailureReason = `${sorted[0][0]} (${sorted[0][1]})`;
        }

        htmlContent += `
          <div class="section">
            <h3 style="font-size: 14px; margin-bottom: 8px;">Overall Stats</h3>
            <table style="font-size: 12px; border-collapse: collapse; width: 100%;">
              <tr>
                <th style="padding: 4px; border: 1px solid #ccc;">Metric</th>
                <th style="padding: 4px; border: 1px solid #ccc;">Value</th>
              </tr>
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">Total Arrivals</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${totalArrivals}</td>
              </tr>
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">Total Check-In Processed</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${checkinProcessed} (${
          totalArrivals
            ? ((checkinProcessed / totalArrivals) * 100).toFixed(2)
            : 0
        }%)</td>
              </tr>
            </table>
          </div>
          <div class="section">
            <h3 style="font-size: 14px; margin-bottom: 8px;">Document Scans / Uploaded</h3>
            <table style="font-size: 12px; border-collapse: collapse; width: 100%;">
              <tr>
                <th style="padding: 4px; border: 1px solid #ccc;">Metric</th>
                <th style="padding: 4px; border: 1px solid #ccc;">Value</th>
              </tr>
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">Aadhaar Card</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${aadhaarScanned}</td>
              </tr>
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">Driving License</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${dlScanned}</td>
              </tr>
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">Passport</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${passportScanned}</td>
              </tr>
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">Voter ID</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${voterScanned}</td>
              </tr>
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">Total Scans / Uploads</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${totalScans}</td>
              </tr>
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">Scanning Issues</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${scanningIssues}</td>
              </tr>
            </table>
          </div>
          <div class="section">
            <h3 style="font-size: 14px; margin-bottom: 8px;">Aadhaar Verification</h3>
            <table style="font-size: 12px; border-collapse: collapse; width: 100%;">
              <tr>
                <th style="padding: 4px; border: 1px solid #ccc;">Metric</th>
                <th style="padding: 4px; border: 1px solid #ccc;">Value</th>
              </tr>
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">Verification Successful</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${aadhaarVerified}</td>
              </tr>
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">Manual Verification</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${manualAadhaar}</td>
              </tr>
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">Verification Failed</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${aadhaarFailed}</td>
              </tr>
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">Top Failure Reason</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${topFailureReason}</td>
              </tr>
            </table>
          </div>
          ${generateArrivalsTable(
            result.stats.arrivalsData,
            result.stats.checkInProcessedData,
            ["bookingId", "checkInDate", "checkOutDate", "checkinTime"]
          )}
          ${generateAdditionalCheckinsTable(
            result.stats.arrivalsData,
            result.stats.checkInProcessedData,
            ["bookingId", "checkInDate", "checkOutDate", "checkinTime"]
          )}
          ${generateTable("Scanning Issues", result.stats.scanningIssueData, [
            "bookingId",
          ])}
          ${generateTable(
            "Documents Scanned / Uploaded",
            result.stats.scansData,
            ["bookingId", "docType",
              //  "docNumber",
                "guestName", "scanned"]
          )}
          ${generateTable(
            "Aadhaar Verifications",
            result.stats.aadhaarVerifiedData,
            ["bookingId", 
              // "docNumber",
               "guestName"]
          )}
          ${generateTable("Aadhaar Failures", result.stats.aadhaarFailureData, [
            "bookingId",
            // "docNumber",
            "guestName",
            "failureReason",
          ])}
          ${generateTable(
            "Manual Aadhaar Verifications",
            result.stats.aadhaarManualData,
            ["bookingId",
              //  "docNumber", 
              "guestName", "verifiedAt"]
          )}
          ${generateOcrFailureTable(
            "OCR Failure Details (Rejected)",
            result.stats.ocrFailureData,
            [
              "bookingId",
              "docType",
              "guestName",
              "timeTakenInSec",
              "docImageFront",
              "docImageBack",
              "reason",
            ],
            result.propertyName
          )}
        `;
      } else {
        htmlContent += `<p style="font-size: 12px;">No stats available for this property on ${reportDate}</p>`;
      }
      htmlContent += `
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    });

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size:12px; width:100%; text-align:center; border-bottom:1px solid #ddd; padding-bottom:5px;">
          <h3>${brandName} | Concise Report for ${reportDate} | Strictly Confidential</h3>
        </div>`,
      footerTemplate: `
        <div style="font-size:12px; width:100%; text-align:center; border-top:1px solid #ddd; padding-top:5px;">
         <span>Report generated on ${currentTime}. Confidential – For internal use only.</span>

        </div>`,
      margin: {
        top: "100px",
        bottom: "100px",
      },
    });
    await browser.close();

    return pdfBuffer;
  } catch (error) {
    console.error("Error generating all stats report:", error);
  }
};

async function generateAndSendReports(reportDate) {
  const connection = getConnection();
  if (!connection) {
    throw new Error("No database connection available");
  }

  const brandDB = connection.useDb("BRAND-LIST-DATA");
  const BrandDatas = getModel(brandDB, "brand_datas", brandDatasSchema);
  const brands = await BrandDatas.find({}).lean();

  const currentTime = moment().tz("Asia/Kolkata").format("DD-MM-YYYY, hh:mm a");

  for (const brandDoc of brands) {
    const brandValue = brandDoc.brand;
    const masterDB = connection.useDb("MASTER-PROPERTY-DATA");
    const properties = await masterDB
      .collection("properties")
      .find({ brand: { $regex: `^${brandValue}$`, $options: "i" } })
      .toArray();

    const pdfBuffer = await generatePdfReport(
      connection,
      brandDoc.brandName,
      properties,
      reportDate,
      currentTime
    );
    await sendEmailReport({
      pdfBuffer,
      subject: `Concise Report for ${brandDoc.brandName} - ${reportDate}`,
      primaryRecipients: brandDoc.primaryMailIds,
      ccRecipients: brandDoc.ccMailIds,
      brandName: brandDoc.brandName,
      brandLogo: brandDoc.brandLogoUrl,
      brandAddress: brandDoc.brandAddress,
      reportDate,
    });
  }
}




module.exports = {
  calculateBookingsData,
  calculateAadhaarData,
  generatePdfReport,
  generateAndSendReports,
};
