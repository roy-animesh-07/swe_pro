const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const cases = require('../controllers/caseController');
const hearings = require('../controllers/hearingController');
const queries = require('../controllers/queryController');
const pastCases = require('../controllers/pastCaseController');

const router = express.Router();
const registrar = [authenticate, requireRole('REGISTRAR')];
const judgeOrLawyer = [authenticate, requireRole('JUDGE', 'LAWYER')];

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Auth
router.post('/auth/login', auth.login);
router.post('/auth/logout', authenticate, auth.logout);
router.get('/auth/me', authenticate, auth.me);

// Users (Registrar)
router.get('/users', registrar, users.listUsers);
router.post('/users', registrar, users.createUser);
router.delete('/users/:username', registrar, users.deleteUser);

// Cases & hearings (Registrar)
router.post('/cases', registrar, cases.registerCase);
router.get('/cases/:cin', registrar, cases.getCase);
router.put('/cases/:cin', registrar, cases.updateCase);
router.post('/cases/:cin/close', registrar, cases.closeCase);
router.get('/hearings/availability', registrar, hearings.availability);
router.post('/cases/:cin/hearings', registrar, hearings.scheduleHearing);
router.post('/cases/:cin/hearings/:hearingId/adjourn', registrar, hearings.adjournHearing);
router.post('/cases/:cin/hearings/:hearingId/complete', registrar, hearings.completeHearing);

// Required Registrar queries
router.get('/queries/pending-cases', registrar, queries.pendingCases);
router.get('/queries/resolved-cases', registrar, queries.resolvedCases);
router.get('/queries/hearings', registrar, queries.hearingsOnDate);
router.get('/queries/status/:cin', registrar, queries.caseStatus);

// Old cases (Judge / Lawyer)
router.get('/past-cases/search', judgeOrLawyer, pastCases.search);
router.post('/past-cases/:cin/view', judgeOrLawyer, pastCases.view);

module.exports = router;
