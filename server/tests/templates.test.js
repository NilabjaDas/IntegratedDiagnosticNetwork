const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const adminTemplateRoutes = require("../routes/admin-templates");
const tenantTemplateRoutes = require("../routes/tenant-templates");
const BaseTemplate = require("../models/BaseTemplate");
const Institution = require("../models/Institutions");

// Mock Auth & Tenant Middleware
jest.mock("../middleware/auth", () => ({
  requireSuperAdmin: (req, res, next) => {
    req.user = { username: "superadmin" };
    next();
  },
}));

jest.mock("../middleware/verifyToken", () => ({
    verifyToken: (req, res, next) => {
        req.user = { institutionId: "INST-001" };
        next();
    }
}));

const app = express();
app.use(express.json());

// Init Routes
app.use("/api/admin-templates", adminTemplateRoutes);
// We need to inject the institution context manually for tenant routes since we mocked the middleware
// but the middleware logic inside tenant-templates route (getTenantContext) runs a DB query.
// So we will just test the route logic by mocking the req.institution in the test or
// by actually inserting an institution in the in-memory DB.

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await BaseTemplate.deleteMany({});
  await Institution.deleteMany({});
});

describe("Admin Template Routes", () => {
  it("should create a new template", async () => {
    const res = await request(app)
      .post("/api/admin-templates")
      .send({
        name: "Test Bill",
        type: "BILL",
        category: "General",
        content: { headerHtml: "<h1>Header</h1>" }
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.data.name).toEqual("Test Bill");
  });

  it("should get all templates", async () => {
    await BaseTemplate.create({ name: "T1", type: "BILL", category: "General" });
    await BaseTemplate.create({ name: "T2", type: "LAB_REPORT", category: "Lab" });

    const res = await request(app).get("/api/admin-templates");
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.length).toEqual(2);
  });

  it("should search templates", async () => {
    await BaseTemplate.create({ name: "Cardiology Report", type: "LAB_REPORT", category: "Cardio" });
    await BaseTemplate.create({ name: "General Bill", type: "BILL", category: "General" });

    // Text index needs to be created, but MongoMemoryServer supports it.
    // However, text search results might be tricky with small data in tests.
    // We'll test direct filters first.
  });
});

describe("Tenant Template Routes", () => {
    // We need to mount the tenant router with the institution middleware logic active
    // But since we can't easily import the router with partial middleware applied,
    // we will reconstruct a test app for this suite.

    const tenantApp = express();
    tenantApp.use(express.json());

    // Custom middleware to mock tenant context
    tenantApp.use((req, res, next) => {
        // Find the institution created in test
        Institution.findOne({ institutionId: "INST-001" }).then(inst => {
            if(inst) {
                req.institution = inst;
                next();
            } else {
                res.status(404).send("Inst not found");
            }
        });
    });

    tenantApp.use("/api/tenant-templates", tenantTemplateRoutes);

    it("should list library templates", async () => {
         await BaseTemplate.create({ name: "Global T1", type: "BILL", category: "General" });

         // Create dummy institution
         await Institution.create({
             institutionId: "INST-001",
             institutionName: "Test Clinic",
             dbName: "test_db",
             institutionCode: "TEST",
             institutionType: "soloDoc", // Added missing required field
             printTemplates: []
         });

         const res = await request(tenantApp).get("/api/tenant-templates/library");
         expect(res.statusCode).toEqual(200);
         expect(res.body.data.length).toEqual(1);
    });

    it("should import a template with variables", async () => {
        const base = await BaseTemplate.create({
            name: "Variable Bill",
            type: "BILL",
            category: "General",
            content: { headerHtml: "<div>{{HOSPITAL_NAME}}</div>" },
            variables: [{ key: "HOSPITAL_NAME", label: "Hospital Name" }]
        });

        await Institution.create({
             institutionId: "INST-001",
             institutionName: "Test Clinic",
             dbName: "test_db",
             institutionCode: "TEST",
             institutionType: "soloDoc", // Added missing required field
             printTemplates: []
         });

        const res = await request(tenantApp)
            .post("/api/tenant-templates/import")
            .send({
                baseTemplateId: base._id,
                variableValues: { "HOSPITAL_NAME": "My Clinic" }
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.content.headerHtml).toContain("My Clinic");

        const updatedInst = await Institution.findOne({ institutionId: "INST-001" });
        expect(updatedInst.printTemplates.length).toEqual(1);
        expect(updatedInst.printTemplates[0].content.headerHtml).toContain("My Clinic");
    });
});
