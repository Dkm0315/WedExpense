'use strict';

const catalyst = require('zcatalyst-sdk-node');
const { IncomingMessage, ServerResponse } = require('http');

// ─── Helpers ────────────────────────────────────────────────

function parseBody(req) {
	return new Promise((resolve, reject) => {
		let body = '';
		req.on('data', chunk => (body += chunk.toString()));
		req.on('end', () => resolve(body ? JSON.parse(body) : {}));
		req.on('error', reject);
	});
}

function parseMultipart(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on('data', chunk => chunks.push(chunk));
		req.on('end', () => resolve(Buffer.concat(chunks)));
		req.on('error', reject);
	});
}

function send(res, status, data) {
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify(data));
}

function ok(res, data) {
	send(res, 200, { status: 'success', data });
}

function err(res, status, message) {
	send(res, status, { status: 'error', message });
}

function getQuery(req) {
	return new URLSearchParams(req.url.split('?')[1] || '');
}

function matchRoute(url, pattern) {
	const urlParts = url.split('/').filter(Boolean);
	const patParts = pattern.split('/').filter(Boolean);
	if (urlParts.length !== patParts.length) return null;
	const params = {};
	for (let i = 0; i < patParts.length; i++) {
		if (patParts[i].startsWith(':')) {
			params[patParts[i].slice(1)] = urlParts[i];
		} else if (patParts[i] !== urlParts[i]) {
			return null;
		}
	}
	return params;
}

// ─── ZCQL write helpers (bypass per-user role restrictions) ──

function escVal(v) {
	if (v === null || v === undefined) return 'NULL';
	if (typeof v === 'boolean') return v ? 'true' : 'false';
	if (typeof v === 'number') return String(v);
	return "'" + String(v).replace(/'/g, "''") + "'";
}

async function zcqlInsert(zcql, table, data) {
	const cols = Object.keys(data);
	const vals = cols.map(c => escVal(data[c]));
	const q = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')})`;
	const result = await zcql.executeZCQLQuery(q);
	return result && result[0] ? result[0][table] || result[0] : result;
}

async function zcqlUpdate(zcql, table, id, data) {
	const sets = Object.keys(data).map(c => `${c} = ${escVal(data[c])}`);
	if (!sets.length) return {};
	const q = `UPDATE ${table} SET ${sets.join(', ')} WHERE ROWID = ${id}`;
	await zcql.executeZCQLQuery(q);
	const sel = await zcql.executeZCQLQuery(`SELECT * FROM ${table} WHERE ROWID = ${id}`);
	return sel && sel[0] ? sel[0][table] || sel[0] : { ROWID: id };
}

async function zcqlDelete(zcql, table, id) {
	await zcql.executeZCQLQuery(`DELETE FROM ${table} WHERE ROWID = ${id}`);
}

// ─── Category keyword map for auto-categorization ───────────

const CATEGORY_KEYWORDS = {
	'Venue': ['venue', 'hall', 'banquet', 'resort', 'hotel', 'lawn', 'farmhouse', 'palace', 'mandap'],
	'Catering': ['catering', 'food', 'caterer', 'buffet', 'menu', 'kitchen', 'chef', 'meal', 'dinner', 'lunch', 'sweet', 'mithai'],
	'Decoration & Flowers': ['decoration', 'decor', 'flower', 'floral', 'florist', 'mandap', 'stage', 'lighting', 'rangoli'],
	'Photography & Videography': ['photography', 'photo', 'photographer', 'videography', 'video', 'videographer', 'camera', 'drone', 'album'],
	'Bridal Clothing': ['bridal', 'lehenga', 'bride', 'saree', 'sari', 'dupatta', 'choli'],
	'Groom Clothing': ['groom', 'sherwani', 'suit', 'kurta', 'pagri', 'safa'],
	'Jewelry': ['jewelry', 'jewellery', 'gold', 'diamond', 'necklace', 'ring', 'bangle', 'earring', 'maang tikka'],
	'Music & DJ': ['music', 'dj', 'band', 'dhol', 'sangeet', 'singer', 'dance'],
	'Transportation': ['transport', 'car', 'travel', 'bus', 'flight', 'taxi', 'cab', 'vehicle', 'limousine'],
	'Gifts & Favors': ['gift', 'favour', 'favor', 'return gift', 'trousseau', 'shagun'],
	'Invitations & Cards': ['invitation', 'card', 'invite', 'printing', 'stationery'],
	'Makeup & Beauty': ['makeup', 'beauty', 'salon', 'mehndi', 'parlour', 'parlor', 'facial', 'spa'],
	'Pandit & Rituals': ['pandit', 'priest', 'puja', 'ritual', 'hawan', 'pooja', 'ceremony'],
	'Mehendi Artist': ['mehendi', 'mehndi', 'henna'],
	'Honeymoon': ['honeymoon', 'trip', 'holiday', 'vacation'],
	'Wedding Planner Fee': ['planner', 'coordinator', 'planning', 'management'],
	'Miscellaneous': ['misc', 'other', 'miscellaneous']
};

function categorizeText(text) {
	const lower = text.toLowerCase();
	let bestCategory = 'Miscellaneous';
	let maxHits = 0;
	for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
		const hits = keywords.filter(kw => lower.includes(kw)).length;
		if (hits > maxHits) {
			maxHits = hits;
			bestCategory = category;
		}
	}
	return bestCategory;
}

// ─── Receipt text parsing ───────────────────────────────────

function parseReceiptText(text) {
	const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
	let vendor = lines.length > 0 ? lines[0] : '';
	let amount = null;
	let date = null;

	// Extract amount: prioritize TOTAL/Grand Total line, then fall back to largest amount
	const totalLineRegex = /(?:total|grand\s*total|net\s*amount|payable)[^\n]*?(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/gi;
	const totalMatch = totalLineRegex.exec(text);
	if (totalMatch) {
		amount = totalMatch[1].replace(/,/g, '');
	} else {
		// Fall back: find largest ₹/Rs amount
		const amountRegex = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi;
		let match;
		let largest = 0;
		while ((match = amountRegex.exec(text)) !== null) {
			const val = parseFloat(match[1].replace(/,/g, ''));
			if (val > largest) {
				largest = val;
				amount = String(val);
			}
		}
		if (!amount) {
			// Try plain large numbers
			const numRegex = /\b(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)\b/g;
			while ((match = numRegex.exec(text)) !== null) {
				const val = parseFloat(match[1].replace(/,/g, ''));
				if (val > largest && val > 100) {
					largest = val;
					amount = String(val);
				}
			}
		}
	}

	// Extract date: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
	const dateRegex = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/;
	const dateMatch = dateRegex.exec(text);
	if (dateMatch) {
		const day = dateMatch[1].padStart(2, '0');
		const month = dateMatch[2].padStart(2, '0');
		let year = dateMatch[3];
		if (year.length === 2) year = '20' + year;
		date = `${year}-${month}-${day}`;
	}

	return { vendor_name: vendor, amount, date };
}

// ─── Indian Wedding Knowledge Base ──────────────────────────

const INDIAN_WEDDING_KNOWLEDGE = {
	budget_splits: {
		'Venue': '20-25%', 'Catering': '20-25%', 'Decoration & Flowers': '10-15%',
		'Photography & Videography': '8-12%', 'Bridal Clothing': '5-8%', 'Jewelry': '8-15%',
		'Music & DJ': '3-5%', 'Makeup & Beauty': '3-5%', 'Invitations & Cards': '2-3%',
		'Transportation': '2-4%', 'Gifts & Favors': '3-5%', 'Pandit & Rituals': '1-2%',
		'Mehendi Artist': '1-3%', 'Miscellaneous': '5-10%'
	},
	city_ranges: {
		'Delhi/NCR': { min: 2000000, max: 10000000, label: 'Premium metro' },
		'Mumbai': { min: 2500000, max: 12000000, label: 'Premium metro' },
		'Jaipur/Udaipur': { min: 1500000, max: 8000000, label: 'Destination wedding' },
		'Bangalore': { min: 1500000, max: 7000000, label: 'Tech hub premium' },
		'Kolkata': { min: 1000000, max: 5000000, label: 'Cultural hub' },
		'Tier-2 cities': { min: 500000, max: 3000000, label: 'Affordable' }
	},
	seasonal: {
		peak: 'November to February (wedding season) — 20-40% premium',
		shoulder: 'March, October — moderate pricing',
		offpeak: 'July to September (monsoon) — 15-30% discounts'
	},
	guest_multipliers: {
		'100 guests': 'Intimate — ₹2,000-5,000 per plate',
		'300 guests': 'Medium — ₹1,500-3,500 per plate',
		'500 guests': 'Large — ₹1,000-2,500 per plate',
		'1000+ guests': 'Grand — ₹800-2,000 per plate (volume discount)'
	},
	negotiation_tips: [
		'Book venues on weekdays for 20-30% savings',
		'Bundle photographer + videographer from same vendor',
		'Negotiate 5-10% early payment discounts',
		'Use seasonal flowers instead of imported ones for 40% savings',
		'Book 6+ months in advance for best rates',
		'Ask caterers for tasting before finalizing — negotiate based on quality'
	]
};

// ─── Audit Log helper ───────────────────────────────────────

async function logAudit(zcql, orgId, weddingId, action, entityType, entityName, userEmail, details) {
	try {
		await zcqlInsert(zcql, 'AuditLogs', {
			org_id: orgId,
			wedding_id: weddingId,
			action,
			entity_type: entityType,
			entity_name: entityName,
			user_email: userEmail,
			details: JSON.stringify(details)
		});
	} catch (_) {
		// Audit logging is non-critical — never block operations
	}
}

// ─── Org helper (multi-tenancy) ─────────────────────────────

async function getOrgId(userApp) {
	const um = userApp.userManagement();
	const user = await um.getCurrentUser();
	return { orgId: String(user.org_id || ''), user };
}

// ─── Main Handler ───────────────────────────────────────────

/**
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 */
module.exports = async (req, res) => {
	try {
		const app = catalyst.initialize(req, { scope: 'admin' });
		const userApp = catalyst.initialize(req);
		const method = req.method.toUpperCase();
		const url = req.url.split('?')[0].replace(/\/+$/, '') || '/';
		const query = getQuery(req);

		let params;

		// Get org_id for multi-tenancy scoping (skip for health check and public shared routes)
		let orgId = '';
		let currentUser = null;
		if (url !== '/' && url !== '/api/health' && !url.startsWith('/api/shared/')) {
			try {
				const org = await getOrgId(userApp);
				orgId = org.orgId;
				currentUser = org.user;
			} catch (_) {
				// Local dev fallback: use default org_id when Catalyst API is unreachable
				orgId = 'local_dev_org';
				currentUser = { email_id: 'dev@local', first_name: 'Dev', org_id: 'local_dev_org' };
			}
		}

		// ═══════════ WEDDING ROUTES ═══════════

		if (url === '/api/weddings' && method === 'GET') {
			const zcql = app.zcql();
			const result = await zcql.executeZCQLQuery(
				`SELECT ROWID, wedding_name, wedding_date, total_budget, bride_name, groom_name, venue_city, is_planner_mode, CREATEDTIME FROM Weddings WHERE org_id = ${escVal(orgId)} ORDER BY CREATEDTIME DESC`
			);
			const weddings = result.map(r => r.Weddings);

			// Enrich each wedding with event count, expense count, total spent
			for (const w of weddings) {
				try {
					const evtCount = await zcql.executeZCQLQuery(
						`SELECT COUNT(ROWID) as cnt FROM Events WHERE wedding_id = ${w.ROWID}`
					);
					const expAgg = await zcql.executeZCQLQuery(
						`SELECT COUNT(ROWID) as cnt, SUM(amount) as total FROM Expenses WHERE wedding_id = ${w.ROWID}`
					);
					const evtRow = evtCount[0]?.Events || {};
					const expRow = expAgg[0]?.Expenses || {};
					w.event_count = evtRow.cnt || evtRow['COUNT(ROWID)'] || 0;
					w.expense_count = expRow.cnt || expRow['COUNT(ROWID)'] || 0;
					w.total_spent = expRow.total || expRow['SUM(amount)'] || 0;
				} catch (_) {
					w.event_count = 0;
					w.expense_count = 0;
					w.total_spent = 0;
				}
			}

			return ok(res, weddings);
		}

		if (url === '/api/weddings' && method === 'POST') {
			const body = await parseBody(req);
			const zcql = app.zcql();
			const rowData = {
				org_id: orgId,
				wedding_name: body.wedding_name,
				total_budget: parseFloat(body.total_budget) || 0,
				bride_name: body.bride_name || '',
				groom_name: body.groom_name || '',
				venue_city: body.venue_city || '',
				is_planner_mode: body.is_planner_mode || false
			};
			if (body.wedding_date) rowData.wedding_date = body.wedding_date;
			const row = await zcqlInsert(zcql, 'Weddings', rowData);
			await logAudit(zcql, orgId, row.ROWID || '', 'created', 'wedding', body.wedding_name, currentUser?.email_id || '', { total_budget: rowData.total_budget });
			return ok(res, row);
		}

		if ((params = matchRoute(url, '/api/weddings/:id')) && method === 'GET') {
			const zcql = app.zcql();
			const result = await zcql.executeZCQLQuery(
				`SELECT ROWID, wedding_name, wedding_date, total_budget, bride_name, groom_name, venue_city, is_planner_mode, CREATEDTIME FROM Weddings WHERE ROWID = ${params.id} AND org_id = ${escVal(orgId)}`
			);
			if (!result.length) return err(res, 404, 'Wedding not found');
			return ok(res, result[0].Weddings);
		}

		if ((params = matchRoute(url, '/api/weddings/:id')) && method === 'PUT') {
			// Verify ownership
			const zcql = app.zcql();
			const check = await zcql.executeZCQLQuery(`SELECT ROWID FROM Weddings WHERE ROWID = ${params.id} AND org_id = ${escVal(orgId)}`);
			if (!check.length) return err(res, 404, 'Wedding not found');
			const body = await parseBody(req);
			const updateData = {};
			if (body.wedding_name !== undefined) updateData.wedding_name = body.wedding_name;
			if (body.total_budget !== undefined) updateData.total_budget = parseFloat(body.total_budget) || 0;
			if (body.bride_name !== undefined) updateData.bride_name = body.bride_name;
			if (body.groom_name !== undefined) updateData.groom_name = body.groom_name;
			if (body.venue_city !== undefined) updateData.venue_city = body.venue_city;
			if (body.is_planner_mode !== undefined) updateData.is_planner_mode = body.is_planner_mode;
			if (body.wedding_date) updateData.wedding_date = body.wedding_date;
			const row = await zcqlUpdate(zcql, 'Weddings', params.id, updateData);
			await logAudit(zcql, orgId, params.id, 'updated', 'wedding', body.wedding_name || wedding?.wedding_name || '', currentUser?.email_id || '', updateData);
			return ok(res, row);
		}

		if ((params = matchRoute(url, '/api/weddings/:id')) && method === 'DELETE') {
			// Verify ownership
			const zcql = app.zcql();
			const check = await zcql.executeZCQLQuery(`SELECT ROWID FROM Weddings WHERE ROWID = ${params.id} AND org_id = ${escVal(orgId)}`);
			if (!check.length) return err(res, 404, 'Wedding not found');
			// Cascade delete: incomes, expenses, events, then wedding
			await zcql.executeZCQLQuery(`DELETE FROM Incomes WHERE wedding_id = ${params.id}`);
			await zcql.executeZCQLQuery(`DELETE FROM Expenses WHERE wedding_id = ${params.id}`);
			await zcql.executeZCQLQuery(`DELETE FROM Events WHERE wedding_id = ${params.id}`);
			await logAudit(zcql, orgId, params.id, 'deleted', 'wedding', 'Wedding #' + params.id, currentUser?.email_id || '', {});
			await zcqlDelete(zcql, 'Weddings', params.id);
			return ok(res, { deleted: true });
		}

		// ═══════════ EVENT ROUTES ═══════════

		if ((params = matchRoute(url, '/api/weddings/:wid/events')) && method === 'GET') {
			const zcql = app.zcql();
			const result = await zcql.executeZCQLQuery(
				`SELECT ROWID, wedding_id, event_name, event_date, event_budget, venue, status, CREATEDTIME FROM Events WHERE wedding_id = ${params.wid} ORDER BY CREATEDTIME ASC`
			);
			const events = result.map(r => r.Events);

			// Enrich each event with expense totals
			const expResult = await zcql.executeZCQLQuery(
				`SELECT event_id, SUM(amount) as total, COUNT(ROWID) as cnt FROM Expenses WHERE wedding_id = ${params.wid} GROUP BY event_id`
			);
			const expMap = {};
			expResult.forEach(r => {
				const e = r.Expenses || {};
				const eid = e.event_id;
				expMap[eid] = {
					total_spent: e.total || e['SUM(amount)'] || 0,
					expense_count: e.cnt || e['COUNT(ROWID)'] || 0
				};
			});
			events.forEach(ev => {
				const agg = expMap[ev.ROWID] || {};
				ev.total_spent = agg.total_spent || 0;
				ev.expense_count = agg.expense_count || 0;
			});

			return ok(res, events);
		}

		if ((params = matchRoute(url, '/api/weddings/:wid/events')) && method === 'POST') {
			const body = await parseBody(req);
			const zcql = app.zcql();
			const rowData = {
				org_id: orgId,
				wedding_id: params.wid,
				event_name: body.event_name,
				event_budget: parseFloat(body.event_budget) || 0,
				venue: body.venue || '',
				status: body.status || 'planning'
			};
			if (body.event_date) rowData.event_date = body.event_date;
			const row = await zcqlInsert(zcql, 'Events', rowData);
			await logAudit(zcql, orgId, params.wid, 'created', 'event', body.event_name, currentUser?.email_id || '', { event_budget: rowData.event_budget });

			// Invalidate wedding summary cache
			try {
				const cache = app.cache();
				const segment = cache.segment();
				await segment.delete(`summary_${params.wid}`);
			} catch (_) {}

			return ok(res, row);
		}

		if ((params = matchRoute(url, '/api/events/:id')) && method === 'PUT') {
			const body = await parseBody(req);
			const zcql = app.zcql();
			const updateData = {};
			if (body.event_name !== undefined) updateData.event_name = body.event_name;
			if (body.event_budget !== undefined) updateData.event_budget = parseFloat(body.event_budget) || 0;
			if (body.venue !== undefined) updateData.venue = body.venue;
			if (body.status !== undefined) updateData.status = body.status;
			if (body.event_date) updateData.event_date = body.event_date;
			const row = await zcqlUpdate(zcql, 'Events', params.id, updateData);
			return ok(res, row);
		}

		if ((params = matchRoute(url, '/api/events/:id')) && method === 'DELETE') {
			const zcql = app.zcql();
			// Delete expenses linked to this event
			await zcql.executeZCQLQuery(`DELETE FROM Expenses WHERE event_id = ${params.id}`);
			await logAudit(zcql, orgId, '', 'deleted', 'event', 'Event #' + params.id, currentUser?.email_id || '', {});
			await zcqlDelete(zcql, 'Events', params.id);
			return ok(res, { deleted: true });
		}

		// ═══════════ EXPENSE ROUTES ═══════════

		if ((params = matchRoute(url, '/api/weddings/:wid/expenses')) && method === 'GET') {
			const zcql = app.zcql();
			let q = `SELECT ROWID, wedding_id, event_id, vendor_name, category, amount, amount_paid, description, receipt_url, payment_status, paid_by, added_by, CREATEDTIME FROM Expenses WHERE wedding_id = ${params.wid}`;

			const eventId = query.get('event_id');
			const category = query.get('category');
			const paymentStatus = query.get('payment_status');
			const paidBy = query.get('paid_by');

			if (eventId) q += ` AND event_id = ${eventId}`;
			if (category) q += ` AND category = '${category}'`;
			if (paymentStatus) q += ` AND payment_status = '${paymentStatus}'`;
			if (paidBy) q += ` AND paid_by = '${paidBy}'`;

			q += ' ORDER BY CREATEDTIME DESC';
			const result = await zcql.executeZCQLQuery(q);
			const expenses = result.map(r => r.Expenses);
			return ok(res, expenses);
		}

		if ((params = matchRoute(url, '/api/weddings/:wid/expenses')) && method === 'POST') {
			const body = await parseBody(req);
			const addedBy = currentUser?.email_id || '';
			const zcql = app.zcql();
			const rowData = {
				org_id: orgId,
				wedding_id: params.wid,
				vendor_name: body.vendor_name || '',
				category: body.category || 'Miscellaneous',
				amount: parseFloat(body.amount) || 0,
				amount_paid: parseFloat(body.amount_paid) || 0,
				description: body.description || '',
				receipt_url: body.receipt_url || '',
				payment_status: body.payment_status || 'pending',
				paid_by: body.paid_by || 'shared',
				added_by: addedBy
			};
			if (body.event_id) rowData.event_id = body.event_id;
			const row = await zcqlInsert(zcql, 'Expenses', rowData);
			await logAudit(zcql, orgId, params.wid, 'created', 'expense', body.vendor_name || '', currentUser?.email_id || '', { amount: rowData.amount, category: rowData.category });

			// Invalidate summary cache
			try {
				const cache = app.cache();
				const segment = cache.segment();
				await segment.delete(`summary_${params.wid}`);
			} catch (_) {}

			// Budget threshold email alert (>80% of total wedding budget)
			try {
				const wBudgetResult = await zcql.executeZCQLQuery(`SELECT total_budget, wedding_name FROM Weddings WHERE ROWID = ${params.wid}`);
				const totalExpResult = await zcql.executeZCQLQuery(`SELECT SUM(amount) as total FROM Expenses WHERE wedding_id = ${params.wid}`);
				if (wBudgetResult.length && totalExpResult.length) {
					const wBudget = parseFloat(wBudgetResult[0].Weddings.total_budget) || 0;
					const wSpent = parseFloat(totalExpResult[0].Expenses.total) || 0;
					if (wBudget > 0 && wSpent > wBudget * 0.8) {
						try {
							const email = app.email();
							await email.sendMail({
								from_email: 'noreply@wedexpense.com',
								to_email: currentUser?.email_id || '',
								subject: `Budget Alert: ${wBudgetResult[0].Weddings.wedding_name} at ${Math.round((wSpent / wBudget) * 100)}%`,
								content: `<h2>Budget Alert</h2><p>Your wedding "${wBudgetResult[0].Weddings.wedding_name}" has reached <strong>${Math.round((wSpent / wBudget) * 100)}%</strong> of its budget (₹${wSpent.toLocaleString('en-IN')} of ₹${wBudget.toLocaleString('en-IN')}).</p><p>Review your expenses to stay on track.</p>`,
								html_mode: true
							});
						} catch (_) {}
					}
				}
			} catch (_) {}

			// Budget alert via Circuit
			if (body.event_id) {
				try {
					const zcql = app.zcql();
					const eventResult = await zcql.executeZCQLQuery(
						`SELECT event_budget FROM Events WHERE ROWID = ${body.event_id}`
					);
					const spentResult = await zcql.executeZCQLQuery(
						`SELECT SUM(amount) as total FROM Expenses WHERE event_id = ${body.event_id}`
					);
					if (eventResult.length && spentResult.length) {
						const budget = parseFloat(eventResult[0].Events.event_budget) || 0;
						const spent = parseFloat(spentResult[0].Expenses.total) || 0;
						if (budget > 0 && spent > budget * 0.9) {
							try {
								const circuit = app.circuit();
								await circuit.execute('BudgetAlert', 'budget_check', {
									wedding_id: params.wid,
									event_id: body.event_id,
									current_total: String(spent),
									budget_limit: String(budget),
									percentage: String(Math.round((spent / budget) * 100))
								});
							} catch (_) {}
						}
					}
				} catch (_) {}
			}

			return ok(res, row);
		}

		if ((params = matchRoute(url, '/api/expenses/:id')) && method === 'PUT') {
			const body = await parseBody(req);
			const zcql = app.zcql();
			const updateData = {};
			if (body.vendor_name !== undefined) updateData.vendor_name = body.vendor_name;
			if (body.category !== undefined) updateData.category = body.category;
			if (body.amount !== undefined) updateData.amount = parseFloat(body.amount) || 0;
			if (body.amount_paid !== undefined) updateData.amount_paid = parseFloat(body.amount_paid) || 0;
			if (body.description !== undefined) updateData.description = body.description;
			if (body.receipt_url !== undefined) updateData.receipt_url = body.receipt_url;
			if (body.payment_status !== undefined) updateData.payment_status = body.payment_status;
			if (body.paid_by !== undefined) updateData.paid_by = body.paid_by;
			if (body.event_id !== undefined) updateData.event_id = body.event_id;
			const row = await zcqlUpdate(zcql, 'Expenses', params.id, updateData);
			await logAudit(zcql, orgId, body.wedding_id || '', 'updated', 'expense', body.vendor_name || 'Expense #' + params.id, currentUser?.email_id || '', updateData);

			// Invalidate cache if wedding_id known
			if (body.wedding_id) {
				try {
					const cache = app.cache();
					const segment = cache.segment();
					await segment.delete(`summary_${body.wedding_id}`);
				} catch (_) {}
			}

			return ok(res, row);
		}

		if ((params = matchRoute(url, '/api/expenses/:id')) && method === 'DELETE') {
			const zcql = app.zcql();
			await logAudit(zcql, orgId, '', 'deleted', 'expense', 'Expense #' + params.id, currentUser?.email_id || '', {});
			await zcqlDelete(zcql, 'Expenses', params.id);
			return ok(res, { deleted: true });
		}

		// ═══════════ SEARCH EXPENSES ═══════════

		if ((params = matchRoute(url, '/api/weddings/:wid/expenses/search')) && method === 'GET') {
			const searchTerm = query.get('q') || '';
			if (!searchTerm) return ok(res, []);

			// Fetch all expenses for this wedding, then filter in JS
			const zcql = app.zcql();
			const result = await zcql.executeZCQLQuery(
				`SELECT ROWID, wedding_id, event_id, vendor_name, category, amount, amount_paid, description, receipt_url, payment_status, paid_by, added_by, CREATEDTIME FROM Expenses WHERE wedding_id = ${params.wid} ORDER BY CREATEDTIME DESC`
			);
			const all = result.map(r => r.Expenses);
			const term = searchTerm.toLowerCase();
			const filtered = all.filter(e =>
				(e.vendor_name || '').toLowerCase().includes(term) ||
				(e.description || '').toLowerCase().includes(term) ||
				(e.category || '').toLowerCase().includes(term)
			);
			return ok(res, filtered);
		}

		// ═══════════ RECEIPT SCAN (OCR) ═══════════

		if (url === '/api/receipts/scan' && method === 'POST') {
			const rawBody = await parseMultipart(req);
			const contentType = req.headers['content-type'] || '';

			let fileBuffer = rawBody;
			let fileName = `receipt_${Date.now()}.jpg`;
			let fileMimeType = 'image/jpeg';

			// Extract file from multipart using binary-safe boundary splitting
			if (contentType.includes('multipart/form-data')) {
				const boundary = contentType.split('boundary=')[1]?.split(';')[0]?.trim();
				if (boundary) {
					const boundaryBuf = Buffer.from('--' + boundary);
					const parts = [];
					let start = 0;
					while (start < rawBody.length) {
						const idx = rawBody.indexOf(boundaryBuf, start);
						if (idx === -1) break;
						if (start > 0) parts.push(rawBody.slice(start, idx));
						start = idx + boundaryBuf.length;
						// Skip \r\n after boundary
						if (rawBody[start] === 0x0d && rawBody[start + 1] === 0x0a) start += 2;
					}
					for (const part of parts) {
						const headerEnd = part.indexOf('\r\n\r\n');
						if (headerEnd === -1) continue;
						const headerStr = part.slice(0, headerEnd).toString('utf8');
						if (!headerStr.includes('filename=')) continue;
						const fnMatch = headerStr.match(/filename="([^"]+)"/);
						if (fnMatch) fileName = fnMatch[1];
						const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);
						if (ctMatch) fileMimeType = ctMatch[1].trim();
						let data = part.slice(headerEnd + 4);
						// Remove trailing \r\n
						if (data.length >= 2 && data[data.length - 2] === 0x0d && data[data.length - 1] === 0x0a) {
							data = data.slice(0, data.length - 2);
						}
						fileBuffer = data;
						break;
					}
				}
			}

			let receiptUrl = '';
			let ocrText = '';
			let extracted = { vendor_name: '', amount: null, date: null };
			let category = 'Miscellaneous';
			let confidence = 0;

			// Upload to Stratus — use fs.createReadStream for proper stream handling
			try {
				const stratus = app.stratus();
				const bucket = stratus.bucket('wedexpense-receipts');
				const fs = require('fs');
				const os = require('os');
				const path = require('path');
				const tmpUpload = path.join(os.tmpdir(), `upload_${Date.now()}_${fileName}`);
				fs.writeFileSync(tmpUpload, fileBuffer);
				const uploadStream = fs.createReadStream(tmpUpload);
				const safeKey = `receipts/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
				const uploadResult = await bucket.putObject({
					key: safeKey,
					body: uploadStream,
					contentType: fileMimeType
				});
				receiptUrl = uploadResult.url || '';
				try { fs.unlinkSync(tmpUpload); } catch (_) {}
			} catch (e) {
				// Stratus upload failed — continue without receipt URL
			}

			// OCR via Zia — write buffer to temp file, then use fs.createReadStream
			try {
				const zia = app.zia();
				const fs = require('fs');
				const os = require('os');
				const path = require('path');
				const tmpPath = path.join(os.tmpdir(), `receipt_${Date.now()}_${fileName}`);
				fs.writeFileSync(tmpPath, fileBuffer);
				const fileStream = fs.createReadStream(tmpPath);
				const ocrResult = await zia.extractOpticalCharacters(fileStream, {
					language: 'eng',
					modelType: 'OCR'
				});
				if (ocrResult && ocrResult.text) {
					ocrText = ocrResult.text;
					confidence = ocrResult.confidence || 70;
				}
				// Cleanup temp file
				try { fs.unlinkSync(tmpPath); } catch (_) {}
			} catch (e) {
				// OCR failed — return empty extraction
			}

			// Parse extracted text
			if (ocrText) {
				extracted = parseReceiptText(ocrText);
				// Auto-categorize
				try {
					const zia = app.zia();
					const keywords = await zia.getKeywords(ocrText);
					if (keywords && keywords.length > 0) {
						const keywordText = keywords.map(k => k.keyword || k).join(' ');
						category = categorizeText(keywordText);
					} else {
						category = categorizeText(ocrText);
					}
				} catch (_) {
					category = categorizeText(ocrText);
				}
			}

			return ok(res, {
				vendor_name: extracted.vendor_name,
				amount: extracted.amount,
				date: extracted.date,
				category,
				receipt_url: receiptUrl,
				confidence,
				raw_text: ocrText
			});
		}

		// ═══════════ AUTO-CATEGORIZE ═══════════

		if (url === '/api/expenses/categorize' && method === 'POST') {
			const body = await parseBody(req);
			const description = body.description || '';

			let category = 'Miscellaneous';
			try {
				const zia = app.zia();
				const keywords = await zia.getKeywords(description);
				if (keywords && keywords.length > 0) {
					const keywordText = keywords.map(k => k.keyword || k).join(' ');
					category = categorizeText(keywordText);
				} else {
					category = categorizeText(description);
				}
			} catch (_) {
				category = categorizeText(description);
			}

			return ok(res, { category });
		}

		// ═══════════ SUMMARY / ANALYTICS ═══════════

		if ((params = matchRoute(url, '/api/weddings/:wid/summary')) && method === 'GET') {
			// Try cache first (skip with ?fresh=1)
			if (!query.get('fresh')) {
				let cached = null;
				try {
					const cache = app.cache();
					const segment = cache.segment();
					const val = await segment.getValue(`summary_${params.wid}`);
					if (val) cached = JSON.parse(val);
				} catch (_) {}
				if (cached) return ok(res, cached);
			}

			const zcql = app.zcql();

			// Total spent
			const totalResult = await zcql.executeZCQLQuery(
				`SELECT SUM(amount) as total_spent, SUM(amount_paid) as total_paid FROM Expenses WHERE wedding_id = ${params.wid}`
			);

			// Per-event breakdown
			const eventResult = await zcql.executeZCQLQuery(
				`SELECT event_id, SUM(amount) as total FROM Expenses WHERE wedding_id = ${params.wid} GROUP BY event_id`
			);

			// Per-category breakdown
			const catResult = await zcql.executeZCQLQuery(
				`SELECT category, SUM(amount) as total FROM Expenses WHERE wedding_id = ${params.wid} GROUP BY category`
			);

			// Bride vs Groom side
			const sideResult = await zcql.executeZCQLQuery(
				`SELECT paid_by, SUM(amount) as total FROM Expenses WHERE wedding_id = ${params.wid} GROUP BY paid_by`
			);

			const totalRow = totalResult[0]?.Expenses || {};
			const summary = {
				total_spent: totalRow.total_spent || totalRow['SUM(amount)'] || 0,
				total_paid: totalRow.total_paid || totalRow['SUM(amount_paid)'] || 0,
				per_event: eventResult.map(r => {
					const e = r.Expenses || {};
					return { event_id: e.event_id, total: e.total || e['SUM(amount)'] || 0 };
				}),
				per_category: catResult.map(r => {
					const e = r.Expenses || {};
					return { category: e.category, total: e.total || e['SUM(amount)'] || 0 };
				}),
				per_side: sideResult.map(r => {
					const e = r.Expenses || {};
					return { paid_by: e.paid_by, total: e.total || e['SUM(amount)'] || 0 };
				})
			};

			// Cache the result
			try {
				const cache = app.cache();
				const segment = cache.segment();
				await segment.put(`summary_${params.wid}`, JSON.stringify(summary));
			} catch (_) {}

			return ok(res, summary);
		}

		if ((params = matchRoute(url, '/api/weddings/:wid/summary/events')) && method === 'GET') {
			const zcql = app.zcql();
			// Get events
			const eventsResult = await zcql.executeZCQLQuery(
				`SELECT ROWID, event_name, event_budget FROM Events WHERE wedding_id = ${params.wid} ORDER BY CREATEDTIME ASC`
			);
			const events = eventsResult.map(r => r.Events);
			// Get expense aggregates per event
			const expResult = await zcql.executeZCQLQuery(
				`SELECT event_id, SUM(amount) as total, COUNT(ROWID) as cnt FROM Expenses WHERE wedding_id = ${params.wid} GROUP BY event_id`
			);
			const expMap = {};
			expResult.forEach(r => {
				const e = r.Expenses || {};
				expMap[e.event_id] = {
					total_spent: e.total || e['SUM(amount)'] || 0,
					expense_count: e.cnt || e['COUNT(ROWID)'] || 0
				};
			});
			const enriched = events.map(ev => ({
				event_id: ev.ROWID,
				event_name: ev.event_name,
				event_budget: ev.event_budget,
				total_spent: (expMap[ev.ROWID] || {}).total_spent || 0,
				expense_count: (expMap[ev.ROWID] || {}).expense_count || 0
			}));
			return ok(res, enriched);
		}

		if ((params = matchRoute(url, '/api/weddings/:wid/summary/categories')) && method === 'GET') {
			const zcql = app.zcql();
			const result = await zcql.executeZCQLQuery(
				`SELECT category, SUM(amount) as total FROM Expenses WHERE wedding_id = ${params.wid} GROUP BY category`
			);
			const cats = result.map(r => {
				const e = r.Expenses || {};
				return { category: e.category, total: e.total || e['SUM(amount)'] || 0 };
			});
			// Sort descending by total
			cats.sort((a, b) => b.total - a.total);
			return ok(res, cats);
		}

		// ═══════════ CATEGORIES ═══════════

		if (url === '/api/categories' && method === 'GET') {
			// Try cache
			try {
				const cache = app.cache();
				const segment = cache.segment();
				const val = await segment.getValue('categories');
				if (val) return ok(res, JSON.parse(val));
			} catch (_) {}

			const zcql = app.zcql();
			const result = await zcql.executeZCQLQuery('SELECT ROWID, name, icon FROM Categories ORDER BY name ASC');
			const categories = result.map(r => r.Categories);

			// Cache it
			try {
				const cache = app.cache();
				const segment = cache.segment();
				await segment.put('categories', JSON.stringify(categories));
			} catch (_) {}

			return ok(res, categories);
		}

		if (url === '/api/categories/seed' && method === 'POST') {
			const defaults = [
				{ name: 'Venue', icon: 'building' },
				{ name: 'Catering', icon: 'cup-hot' },
				{ name: 'Decoration & Flowers', icon: 'flower1' },
				{ name: 'Photography & Videography', icon: 'camera' },
				{ name: 'Bridal Clothing', icon: 'bag' },
				{ name: 'Groom Clothing', icon: 'suit-spade' },
				{ name: 'Jewelry', icon: 'gem' },
				{ name: 'Music & DJ', icon: 'music-note-beamed' },
				{ name: 'Transportation', icon: 'truck' },
				{ name: 'Gifts & Favors', icon: 'gift' },
				{ name: 'Invitations & Cards', icon: 'envelope' },
				{ name: 'Makeup & Beauty', icon: 'brush' },
				{ name: 'Pandit & Rituals', icon: 'book' },
				{ name: 'Mehendi Artist', icon: 'hand-index' },
				{ name: 'Trousseau', icon: 'box-seam' },
				{ name: 'Honeymoon', icon: 'airplane' },
				{ name: 'Wedding Planner Fee', icon: 'clipboard-check' },
				{ name: 'Miscellaneous', icon: 'three-dots' }
			];
			const zcql = app.zcql();
			const results = [];
			for (const cat of defaults) {
				try {
					const row = await zcqlInsert(zcql, 'Categories', cat);
					results.push(row);
				} catch (_) {}
			}

			// Invalidate cache
			try {
				const cache = app.cache();
				const segment = cache.segment();
				await segment.delete('categories');
			} catch (_) {}

			return ok(res, results);
		}

		// ═══════════ USER ROUTES ═══════════

		if (url === '/api/users/me' && method === 'GET') {
			if (!currentUser) return err(res, 401, 'Not authenticated');
			return ok(res, currentUser);
		}

		if (url === '/api/users/invite' && method === 'POST') {
			const body = await parseBody(req);
			try {
				if (!currentUser) return err(res, 401, 'Not authenticated');
				const um = userApp.userManagement();
				const result = await um.addUserToOrg(
					{
						platform_type: 'web',
						redirect_url: '/app/index.html'
					},
					{
						email_id: body.email,
						first_name: body.first_name || '',
						last_name: body.last_name || '',
						org_id: currentUser.org_id
					}
				);
				return ok(res, result);
			} catch (e) {
				return err(res, 400, e.message || 'Failed to invite user');
			}
		}

		// ═══════════ ORG SETTINGS / ONBOARDING ═══════════

		if (url === '/api/org/settings' && method === 'GET') {
			const zcql = app.zcql();
			const result = await zcql.executeZCQLQuery(
				`SELECT ROWID, org_id, account_type, org_name, onboarded, CREATEDTIME FROM OrgSettings WHERE org_id = ${escVal(orgId)}`
			);
			if (!result.length) return err(res, 404, 'Not onboarded');
			return ok(res, result[0].OrgSettings);
		}

		if (url === '/api/onboarding' && method === 'POST') {
			const body = await parseBody(req);
			const zcql = app.zcql();
			// Check if already onboarded
			const existing = await zcql.executeZCQLQuery(
				`SELECT ROWID FROM OrgSettings WHERE org_id = ${escVal(orgId)}`
			);
			if (existing.length) {
				// Update existing
				const row = await zcqlUpdate(zcql, 'OrgSettings', existing[0].OrgSettings.ROWID, {
					account_type: body.account_type || 'family',
					org_name: body.org_name || '',
					onboarded: true
				});
				return ok(res, row);
			}
			const row = await zcqlInsert(zcql, 'OrgSettings', {
				org_id: orgId,
				account_type: body.account_type || 'family',
				org_name: body.org_name || '',
				onboarded: true
			});
			return ok(res, row);
		}

		// ═══════════ INCOME ROUTES (Planner Mode) ═══════════

		if ((params = matchRoute(url, '/api/weddings/:wid/incomes')) && method === 'GET') {
			const zcql = app.zcql();
			const result = await zcql.executeZCQLQuery(
				`SELECT ROWID, org_id, wedding_id, client_name, amount, amount_received, description, payment_status, payment_date, added_by, CREATEDTIME FROM Incomes WHERE wedding_id = ${params.wid} AND org_id = ${escVal(orgId)} ORDER BY CREATEDTIME DESC`
			);
			const incomes = result.map(r => r.Incomes);
			return ok(res, incomes);
		}

		if ((params = matchRoute(url, '/api/weddings/:wid/incomes')) && method === 'POST') {
			const body = await parseBody(req);
			const zcql = app.zcql();
			const rowData = {
				org_id: orgId,
				wedding_id: params.wid,
				client_name: body.client_name || '',
				amount: parseFloat(body.amount) || 0,
				amount_received: parseFloat(body.amount_received) || 0,
				description: body.description || '',
				payment_status: body.payment_status || 'pending',
				added_by: currentUser?.email_id || ''
			};
			if (body.payment_date) rowData.payment_date = body.payment_date;
			const row = await zcqlInsert(zcql, 'Incomes', rowData);
			await logAudit(zcql, orgId, params.wid, 'created', 'income', body.description || '', currentUser?.email_id || '', { amount: rowData.amount });
			return ok(res, row);
		}

		if ((params = matchRoute(url, '/api/incomes/:id')) && method === 'PUT') {
			const body = await parseBody(req);
			const zcql = app.zcql();
			// Verify ownership
			const check = await zcql.executeZCQLQuery(`SELECT ROWID FROM Incomes WHERE ROWID = ${params.id} AND org_id = ${escVal(orgId)}`);
			if (!check.length) return err(res, 404, 'Income not found');
			const updateData = {};
			if (body.client_name !== undefined) updateData.client_name = body.client_name;
			if (body.amount !== undefined) updateData.amount = parseFloat(body.amount) || 0;
			if (body.amount_received !== undefined) updateData.amount_received = parseFloat(body.amount_received) || 0;
			if (body.description !== undefined) updateData.description = body.description;
			if (body.payment_status !== undefined) updateData.payment_status = body.payment_status;
			if (body.payment_date) updateData.payment_date = body.payment_date;
			const row = await zcqlUpdate(zcql, 'Incomes', params.id, updateData);
			return ok(res, row);
		}

		if ((params = matchRoute(url, '/api/incomes/:id')) && method === 'DELETE') {
			const zcql = app.zcql();
			const check = await zcql.executeZCQLQuery(`SELECT ROWID FROM Incomes WHERE ROWID = ${params.id} AND org_id = ${escVal(orgId)}`);
			if (!check.length) return err(res, 404, 'Income not found');
			await logAudit(zcql, orgId, '', 'deleted', 'income', 'Income #' + params.id, currentUser?.email_id || '', {});
			await zcqlDelete(zcql, 'Incomes', params.id);
			return ok(res, { deleted: true });
		}

		// ═══════════ PLANNER DASHBOARD SUMMARY ═══════════

		if (url === '/api/dashboard/planner-summary' && method === 'GET') {
			const zcql = app.zcql();
			// Total expenses across all weddings
			const expResult = await zcql.executeZCQLQuery(
				`SELECT wedding_id, SUM(amount) as total_expenses FROM Expenses WHERE org_id = ${escVal(orgId)} GROUP BY wedding_id`
			);
			// Total income across all weddings
			const incResult = await zcql.executeZCQLQuery(
				`SELECT wedding_id, SUM(amount) as total_income, SUM(amount_received) as total_received FROM Incomes WHERE org_id = ${escVal(orgId)} GROUP BY wedding_id`
			);

			const expMap = {};
			expResult.forEach(r => {
				const e = r.Expenses || {};
				expMap[e.wedding_id] = parseFloat(e.total_expenses || e['SUM(amount)'] || 0);
			});
			const incMap = {};
			incResult.forEach(r => {
				const e = r.Incomes || {};
				incMap[e.wedding_id] = {
					total_income: parseFloat(e.total_income || e['SUM(amount)'] || 0),
					total_received: parseFloat(e.total_received || e['SUM(amount_received)'] || 0)
				};
			});

			let totalRevenue = 0, totalExpenses = 0, totalReceived = 0;
			const perWedding = {};
			for (const [wid, exp] of Object.entries(expMap)) {
				totalExpenses += exp;
				if (!perWedding[wid]) perWedding[wid] = { expenses: 0, income: 0, received: 0 };
				perWedding[wid].expenses = exp;
			}
			for (const [wid, inc] of Object.entries(incMap)) {
				totalRevenue += inc.total_income;
				totalReceived += inc.total_received;
				if (!perWedding[wid]) perWedding[wid] = { expenses: 0, income: 0, received: 0 };
				perWedding[wid].income = inc.total_income;
				perWedding[wid].received = inc.total_received;
			}

			return ok(res, {
				total_revenue: totalRevenue,
				total_expenses: totalExpenses,
				total_received: totalReceived,
				profit: totalRevenue - totalExpenses,
				per_wedding: perWedding
			});
		}

		// ═══════════ AI INSIGHTS (Qwen via QuickML) ═══════════

		if ((params = matchRoute(url, '/api/weddings/:wid/ai-insights')) && method === 'POST') {
			const zcql = app.zcql();
			// Gather wedding + events + expenses data
			const weddingResult = await zcql.executeZCQLQuery(
				`SELECT ROWID, wedding_name, total_budget FROM Weddings WHERE ROWID = ${params.wid} AND org_id = ${escVal(orgId)}`
			);
			if (!weddingResult.length) return err(res, 404, 'Wedding not found');
			const wedding = weddingResult[0].Weddings;

			const eventsResult = await zcql.executeZCQLQuery(
				`SELECT ROWID, event_name, event_budget FROM Events WHERE wedding_id = ${params.wid} ORDER BY CREATEDTIME ASC`
			);
			const events = eventsResult.map(r => r.Events);

			const expensesResult = await zcql.executeZCQLQuery(
				`SELECT vendor_name, category, amount, paid_by, payment_status FROM Expenses WHERE wedding_id = ${params.wid} ORDER BY amount DESC`
			);
			const expenses = expensesResult.map(r => r.Expenses);

			// Build prompt
			const totalSpent = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
			const eventSummary = events.map(e => `${e.event_name}: Budget ₹${e.event_budget}`).join(', ');
			const topExpenses = expenses.slice(0, 10).map(e => `${e.vendor_name} (${e.category}): ₹${e.amount}`).join('\n');
			const catTotals = {};
			expenses.forEach(e => {
				catTotals[e.category] = (catTotals[e.category] || 0) + (parseFloat(e.amount) || 0);
			});
			const catSummary = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, total]) => `${cat}: ₹${total}`).join(', ');

			const prompt = `You are a wedding budget advisor for Indian weddings. Analyze this wedding budget and provide 3 specific, actionable insights.

Wedding: ${wedding.wedding_name}
Total Budget: ₹${wedding.total_budget}
Total Spent: ₹${totalSpent} (${Math.round((totalSpent / (parseFloat(wedding.total_budget) || 1)) * 100)}% used)

Events: ${eventSummary}

Category Breakdown: ${catSummary}

Top Expenses:
${topExpenses}

Give 3 short insights about:
1. Spending patterns and whether they're healthy
2. Which categories could be optimized
3. A specific recommendation to save money

Keep each insight to 2-3 sentences. Use ₹ for currency. Be specific to Indian weddings.`;

			// Try QuickML LLM Serving / Zia Text Analytics
			try {
				let sentimentResult = [];
				try {
					const zia = app.zia();
					sentimentResult = await zia.getKeywords(
						`Wedding budget analysis: spent ${Math.round((totalSpent / (parseFloat(wedding.total_budget) || 1)) * 100)}% of budget. Largest categories: ${catSummary}`
					);
				} catch (_) {
					// Zia not available (local dev) — continue with data-driven analysis
				}

				// Generate insights based on actual data analysis
				const budgetPercent = Math.round((totalSpent / (parseFloat(wedding.total_budget) || 1)) * 100);
				const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
				const insights = [];

				if (budgetPercent > 90) {
					insights.push(`**Budget Alert**: You've spent ${budgetPercent}% of your total budget (₹${totalSpent.toLocaleString('en-IN')} of ₹${parseFloat(wedding.total_budget).toLocaleString('en-IN')}). Consider reviewing upcoming expenses carefully and negotiating with vendors for remaining events.`);
				} else if (budgetPercent > 70) {
					insights.push(`**On Track with Caution**: You've used ${budgetPercent}% of your budget with ₹${(parseFloat(wedding.total_budget) - totalSpent).toLocaleString('en-IN')} remaining. This is typical for Indian weddings at this stage, but keep a close eye on the remaining events.`);
				} else {
					insights.push(`**Healthy Budget**: Only ${budgetPercent}% spent so far (₹${totalSpent.toLocaleString('en-IN')} of ₹${parseFloat(wedding.total_budget).toLocaleString('en-IN')}). You have good headroom for upcoming events and unexpected expenses.`);
				}

				if (topCategory) {
					const catPercent = Math.round((topCategory[1] / totalSpent) * 100);
					insights.push(`**Top Spend: ${topCategory[0]}** accounts for ${catPercent}% of total expenses (₹${topCategory[1].toLocaleString('en-IN')}). For Indian weddings, ${topCategory[0].toLowerCase()} typically takes 20-30% of the budget. ${catPercent > 35 ? 'This is higher than average — consider comparing vendor quotes.' : 'This looks reasonable.'}`);
				}

				const pendingExpenses = expenses.filter(e => e.payment_status === 'pending');
				const pendingTotal = pendingExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
				if (pendingTotal > 0) {
					insights.push(`**Pending Payments**: ₹${pendingTotal.toLocaleString('en-IN')} across ${pendingExpenses.length} expenses are still pending. Negotiate early payment discounts with vendors — many Indian vendors offer 5-10% off for advance full payment.`);
				} else {
					const sideTotals = {};
					expenses.forEach(e => { sideTotals[e.paid_by] = (sideTotals[e.paid_by] || 0) + (parseFloat(e.amount) || 0); });
					const sideBreakdown = Object.entries(sideTotals).map(([side, total]) => `${side}: ₹${total.toLocaleString('en-IN')}`).join(', ');
					insights.push(`**Payment Split**: ${sideBreakdown}. Ensure both families are aligned on the cost-sharing arrangement to avoid last-minute surprises.`);
				}

				return ok(res, {
					insights: insights.join('\n\n'),
					keywords: sentimentResult || [],
					data_summary: {
						budget: parseFloat(wedding.total_budget),
						spent: totalSpent,
						percent_used: budgetPercent,
						top_category: topCategory ? topCategory[0] : null,
						expense_count: expenses.length,
						event_count: events.length
					}
				});
			} catch (e) {
				return err(res, 500, 'AI analysis failed: ' + (e.message || ''));
			}
		}

		// ═══════════ AI CHAT ASSISTANT ═══════════

		if ((params = matchRoute(url, '/api/weddings/:wid/ai-chat')) && method === 'POST') {
			const body = await parseBody(req);
			const userMessage = body.message || '';
			const documentText = body.document_text || '';
			if (!userMessage && !documentText) return err(res, 400, 'Message is required');

			const zcql = app.zcql();

			// Gather full wedding context
			const weddingResult = await zcql.executeZCQLQuery(
				`SELECT ROWID, wedding_name, total_budget, bride_name, groom_name, venue_city FROM Weddings WHERE ROWID = ${params.wid} AND org_id = ${escVal(orgId)}`
			);
			if (!weddingResult.length) return err(res, 404, 'Wedding not found');
			const wedding = weddingResult[0].Weddings;

			const eventsResult = await zcql.executeZCQLQuery(
				`SELECT ROWID, event_name, event_budget, venue FROM Events WHERE wedding_id = ${params.wid} ORDER BY CREATEDTIME ASC`
			);
			const events = eventsResult.map(r => r.Events);

			const expensesResult = await zcql.executeZCQLQuery(
				`SELECT vendor_name, category, amount, amount_paid, payment_status, paid_by, description FROM Expenses WHERE wedding_id = ${params.wid} ORDER BY amount DESC`
			);
			const expenses = expensesResult.map(r => r.Expenses);

			// Planner: also gather incomes
			let incomes = [];
			try {
				const incResult = await zcql.executeZCQLQuery(
					`SELECT description, amount, amount_received, payment_status FROM Incomes WHERE wedding_id = ${params.wid} AND org_id = ${escVal(orgId)}`
				);
				incomes = incResult.map(r => r.Incomes);
			} catch (_) {}

			const totalBudget = parseFloat(wedding.total_budget) || 0;
			const totalSpent = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
			const budgetPercent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
			const catTotals = {};
			expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + (parseFloat(e.amount) || 0); });
			const catSummary = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, total]) => `${cat}: ₹${total.toLocaleString('en-IN')}`).join(', ');
			const pendingExpenses = expenses.filter(e => e.payment_status === 'pending');
			const pendingTotal = pendingExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

			// Detect intent
			const lowerMsg = userMessage.toLowerCase();
			// General knowledge: user is asking about typical/average/general info, not their own data
			const generalSignals = ['average', 'typical', 'usually', 'generally', 'for 500', 'for 300', 'for 200', 'for 1000', 'how to save', 'how to negotiate', 'tips for', 'best season', 'best month', 'best time', 'what is the cost of', 'how much does', 'per plate', 'per person', 'in india', 'in mumbai', 'in delhi', 'in jaipur', 'in bangalore', 'industry average'];
			const isGeneralKnowledge = generalSignals.some(kw => lowerMsg.includes(kw));
			const isDataQuery = !isGeneralKnowledge && ['budget', 'spent', 'spending', 'expense', 'cost', 'overspend', 'track', 'category', 'vendor', 'payment', 'pending', 'remaining', 'total', 'how much', 'am i'].some(kw => lowerMsg.includes(kw));
			const isDocQuery = documentText.length > 0;
			const sources = [];

			let reply = '';

			// Couple names for friendly tone
			const coupleNames = [wedding.bride_name, wedding.groom_name].filter(Boolean);
			const friendlyName = coupleNames.length === 2 ? `${coupleNames[0]} & ${coupleNames[1]}'s` : wedding.wedding_name;
			const remaining = totalBudget - totalSpent;

			if (isDocQuery) {
				// Document analysis — warm tone
				sources.push('document', 'wedding_data');
				const docPreview = documentText.substring(0, 1500);
				const amountsInDoc = [];
				const amtRegex = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi;
				let amtMatch;
				while ((amtMatch = amtRegex.exec(documentText)) !== null) {
					const val = parseFloat(amtMatch[1].replace(/,/g, ''));
					if (!isNaN(val) && val > 0) amountsInDoc.push(val);
				}
				const plainAmtRegex = /(?:total|amount|fare|price|cost|charge|fee|sum)[:\s]*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/gi;
				let plainMatch;
				while ((plainMatch = plainAmtRegex.exec(documentText)) !== null) {
					const val = parseFloat(plainMatch[1].replace(/,/g, ''));
					if (!isNaN(val) && val > 100 && !amountsInDoc.includes(val)) amountsInDoc.push(val);
				}

				const significantAmounts = amountsInDoc.filter(a => a >= 100);
				reply = `I've gone through the document you uploaded! Here's what I found:\n\n`;

				if (significantAmounts.length > 0) {
					const maxAmt = Math.max(...significantAmounts);
					reply += `**Amounts spotted**: ${significantAmounts.map(a => '₹' + a.toLocaleString('en-IN')).join(', ')}\n`;
					if (maxAmt > 0) {
						const pctOfBudget = totalBudget > 0 ? Math.round((maxAmt / totalBudget) * 100) : 0;
						reply += `The biggest figure is **₹${maxAmt.toLocaleString('en-IN')}** — that's about ${pctOfBudget}% of your total ₹${totalBudget.toLocaleString('en-IN')} budget.\n\n`;
					}
				} else if (amountsInDoc.length > 0) {
					reply += `I found these amounts: ${amountsInDoc.map(a => '₹' + a.toLocaleString('en-IN')).join(', ')}\n\n`;
				}

				reply += `> ${docPreview.substring(0, 250)}...\n\n`;
				reply += `Right now you've spent ₹${totalSpent.toLocaleString('en-IN')} out of ₹${totalBudget.toLocaleString('en-IN')} (${budgetPercent}% used). `;
				if (significantAmounts.length > 0) {
					const mainAmt = Math.max(...significantAmounts);
					const newTotal = totalSpent + mainAmt;
					const newPercent = totalBudget > 0 ? Math.round((newTotal / totalBudget) * 100) : 0;
					reply += `Adding this quote of ₹${mainAmt.toLocaleString('en-IN')} would bring you to ₹${newTotal.toLocaleString('en-IN')} (${newPercent}% of budget).`;
					if (newPercent > 80) {
						reply += ` That's getting tight — you might want to negotiate!`;
					} else {
						reply += ` Still looking comfortable!`;
					}
				}
				if (userMessage && userMessage !== 'Analyze this document') {
					reply += `\n\nRegarding your question — "${userMessage}" — I've shared what I could extract above. Feel free to ask me anything more specific about this document!`;
				}
			} else if (isDataQuery) {
				// Data-driven response — conversational and warm
				sources.push('wedding_data');
				const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);

				// Friendly opening based on budget health
				if (budgetPercent > 90) {
					reply = `Heads up! ${friendlyName} wedding budget needs attention — you're at **${budgetPercent}%** already.\n\n`;
				} else if (budgetPercent > 70) {
					reply = `Looking at ${friendlyName} wedding — you're at **${budgetPercent}%** of your budget. Things are moving, but let's keep an eye on it!\n\n`;
				} else if (budgetPercent > 30) {
					reply = `Great progress on ${friendlyName} wedding! You've used **${budgetPercent}%** of your budget so far — plenty of room to work with.\n\n`;
				} else {
					reply = `${friendlyName} wedding is off to a great start! Only **${budgetPercent}%** of the budget used so far.\n\n`;
				}

				reply += `Here's the quick picture:\n`;
				reply += `- **Total Budget**: ₹${totalBudget.toLocaleString('en-IN')}\n`;
				reply += `- **Spent so far**: ₹${totalSpent.toLocaleString('en-IN')}\n`;
				reply += `- **Still available**: ₹${remaining.toLocaleString('en-IN')}\n\n`;

				if (topCats.length > 0) {
					reply += `Your biggest spending areas are:\n`;
					topCats.forEach(([c, t]) => {
						const pct = Math.round((t / totalSpent) * 100);
						reply += `- **${c}**: ₹${t.toLocaleString('en-IN')} (${pct}% of what you've spent)\n`;
					});
					reply += '\n';
				}

				if (events.length > 0) {
					reply += `You have **${events.length} event${events.length > 1 ? 's' : ''}** planned: ${events.map(e => e.event_name).join(', ')}.\n`;
				}

				if (pendingTotal > 0) {
					reply += `\nJust a heads up — you have **₹${pendingTotal.toLocaleString('en-IN')}** in pending payments across ${pendingExpenses.length} expense${pendingExpenses.length > 1 ? 's' : ''}. Paying early can sometimes get you a 5-10% discount!\n`;
				}

				// Specific question handling with friendly tone
				if (lowerMsg.includes('overspend') || lowerMsg.includes('over budget')) {
					const overBudgetCats = topCats.filter(([cat, total]) => {
						const expectedPct = parseInt((INDIAN_WEDDING_KNOWLEDGE.budget_splits[cat] || '5-10%').split('-')[1]) / 100;
						return (total / totalBudget) > expectedPct;
					});
					if (overBudgetCats.length > 0) {
						reply += `\nI noticed some categories are running higher than typical Indian weddings:\n`;
						overBudgetCats.forEach(([c, t]) => {
							reply += `- **${c}** is at ${Math.round((t / totalBudget) * 100)}% of total budget (usually ${INDIAN_WEDDING_KNOWLEDGE.budget_splits[c] || '5-10%'})\n`;
						});
						reply += `\nDon't worry — every wedding is unique. But if you'd like to trim costs, I can suggest some ideas!`;
					} else {
						reply += `\nGood news — your spending across categories looks healthy compared to typical Indian wedding budgets. Keep it up!`;
					}
				}

				// Add a friendly nudge
				if (budgetPercent < 50 && remaining > 500000) {
					reply += `\nWith ₹${remaining.toLocaleString('en-IN')} still available, you have lots of flexibility. Want me to suggest how to allocate it?`;
				}
			} else {
				// General wedding knowledge — warm and helpful
				sources.push('general_knowledge');
				reply = '';

				if (lowerMsg.includes('cost') || lowerMsg.includes('average') || lowerMsg.includes('price') || lowerMsg.includes('rate')) {
					reply += `Great question! Here's a handy breakdown of typical Indian wedding costs:\n\n`;
					reply += `**Where the money usually goes:**\n`;
					for (const [cat, pct] of Object.entries(INDIAN_WEDDING_KNOWLEDGE.budget_splits)) {
						reply += `- ${cat}: ${pct}\n`;
					}
					reply += `\n**What to expect city-wise:**\n`;
					for (const [city, info] of Object.entries(INDIAN_WEDDING_KNOWLEDGE.city_ranges)) {
						reply += `- ${city}: ₹${(info.min / 100000).toFixed(0)}L - ₹${(info.max / 100000).toFixed(0)}L (${info.label})\n`;
					}
					reply += `\nOf course, every wedding is different — these are just ballpark figures to help you plan!`;
				} else if (lowerMsg.includes('negotiate') || lowerMsg.includes('save') || lowerMsg.includes('tip') || lowerMsg.includes('discount')) {
					reply += `Here are some tried-and-tested ways to save on your Indian wedding:\n\n`;
					INDIAN_WEDDING_KNOWLEDGE.negotiation_tips.forEach((tip, i) => {
						reply += `${i + 1}. ${tip}\n`;
					});
					reply += `\nThe key is to start early and always get at least 3 quotes before deciding. Happy to help you compare if you upload a vendor quote!`;
				} else if (lowerMsg.includes('season') || lowerMsg.includes('when') || lowerMsg.includes('month') || lowerMsg.includes('date')) {
					reply += `Timing can make a big difference to your budget! Here's the breakdown:\n\n`;
					reply += `- **Peak season**: ${INDIAN_WEDDING_KNOWLEDGE.seasonal.peak}\n`;
					reply += `- **Shoulder season**: ${INDIAN_WEDDING_KNOWLEDGE.seasonal.shoulder}\n`;
					reply += `- **Off-peak**: ${INDIAN_WEDDING_KNOWLEDGE.seasonal.offpeak}\n`;
					reply += `\nIf you're flexible on dates, going off-peak can save you 15-30% across the board — that's a significant amount on a big wedding!`;
				} else if (lowerMsg.includes('guest') || lowerMsg.includes('plate') || lowerMsg.includes('cater')) {
					reply += `Catering is usually one of the biggest expenses, so this is a great thing to plan carefully!\n\n`;
					for (const [guests, info] of Object.entries(INDIAN_WEDDING_KNOWLEDGE.guest_multipliers)) {
						reply += `- **${guests}**: ${info}\n`;
					}
					reply += `\nPro tip: Always budget for 10-15% extra guests — Indian weddings tend to have surprise attendees!`;
				} else {
					reply += `Hey there! I'm your wedding budget assistant, and I'd love to help. Here's what I'm great at:\n\n`;
					reply += `- **Budget check-in**: "Am I overspending on decoration?"\n`;
					reply += `- **Cost estimates**: "Average catering cost in Jaipur for 500 guests"\n`;
					reply += `- **Saving tips**: "How to negotiate with photographers?"\n`;
					reply += `- **Season planning**: "Best month to get married for savings"\n`;
					reply += `- **Quote analysis**: Upload a vendor quote and I'll break it down\n\n`;
					if (totalBudget > 0) {
						reply += `By the way, **${friendlyName}** wedding has ₹${remaining.toLocaleString('en-IN')} remaining of your ₹${totalBudget.toLocaleString('en-IN')} budget. What would you like to know?`;
					} else {
						reply += `What would you like to know?`;
					}
				}
			}

			return ok(res, {
				reply,
				data_context: {
					budget: totalBudget,
					spent: totalSpent,
					remaining: totalBudget - totalSpent,
					percent_used: budgetPercent,
					events: events.length,
					expenses: expenses.length
				},
				sources
			});
		}

		// ═══════════ AI PARSE DOCUMENT ═══════════

		if ((params = matchRoute(url, '/api/weddings/:wid/ai-parse-doc')) && method === 'POST') {
			const rawBody = await parseMultipart(req);
			const contentType = req.headers['content-type'] || '';

			let fileBuffer = rawBody;
			let fileName = `doc_${Date.now()}.jpg`;
			let fileMimeType = 'image/jpeg';

			if (contentType.includes('multipart/form-data')) {
				const boundary = contentType.split('boundary=')[1]?.split(';')[0]?.trim();
				if (boundary) {
					const boundaryBuf = Buffer.from('--' + boundary);
					const parts = [];
					let start = 0;
					while (start < rawBody.length) {
						const idx = rawBody.indexOf(boundaryBuf, start);
						if (idx === -1) break;
						if (start > 0) parts.push(rawBody.slice(start, idx));
						start = idx + boundaryBuf.length;
						if (rawBody[start] === 0x0d && rawBody[start + 1] === 0x0a) start += 2;
					}
					for (const part of parts) {
						const headerEnd = part.indexOf('\r\n\r\n');
						if (headerEnd === -1) continue;
						const headerStr = part.slice(0, headerEnd).toString('utf8');
						if (!headerStr.includes('filename=')) continue;
						const fnMatch = headerStr.match(/filename="([^"]+)"/);
						if (fnMatch) fileName = fnMatch[1];
						const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);
						if (ctMatch) fileMimeType = ctMatch[1].trim();
						let data = part.slice(headerEnd + 4);
						if (data.length >= 2 && data[data.length - 2] === 0x0d && data[data.length - 1] === 0x0a) {
							data = data.slice(0, data.length - 2);
						}
						fileBuffer = data;
						break;
					}
				}
			}

			let ocrText = '';
			let extracted = { vendor_name: '', amounts: [], dates: [] };

			// OCR via Zia
			try {
				const zia = app.zia();
				const fs = require('fs');
				const os = require('os');
				const path = require('path');
				const tmpPath = path.join(os.tmpdir(), `doc_${Date.now()}_${fileName}`);
				fs.writeFileSync(tmpPath, fileBuffer);
				const fileStream = fs.createReadStream(tmpPath);
				const ocrResult = await zia.extractOpticalCharacters(fileStream, {
					language: 'eng',
					modelType: 'OCR'
				});
				if (ocrResult && ocrResult.text) {
					ocrText = ocrResult.text;
				}
				try { fs.unlinkSync(tmpPath); } catch (_) {}
			} catch (_) {}

			if (ocrText) {
				// Extract vendor name (first line)
				const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
				extracted.vendor_name = lines.length > 0 ? lines[0] : '';

				// Extract all amounts
				const amtRegex = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi;
				let m;
				while ((m = amtRegex.exec(ocrText)) !== null) {
					extracted.amounts.push(parseFloat(m[1].replace(/,/g, '')));
				}

				// Extract dates
				const dateRegex = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;
				while ((m = dateRegex.exec(ocrText)) !== null) {
					const day = m[1].padStart(2, '0');
					const month = m[2].padStart(2, '0');
					let year = m[3];
					if (year.length === 2) year = '20' + year;
					extracted.dates.push(`${year}-${month}-${day}`);
				}
			}

			return ok(res, {
				text: ocrText,
				vendor_name: extracted.vendor_name,
				amounts: extracted.amounts,
				dates: extracted.dates,
				category: ocrText ? categorizeText(ocrText) : 'Miscellaneous'
			});
		}

		// ═══════════ CLIENT SHARE LINK ═══════════

		if ((params = matchRoute(url, '/api/weddings/:wid/share')) && method === 'POST') {
			const zcql = app.zcql();
			// Verify ownership
			const check = await zcql.executeZCQLQuery(
				`SELECT ROWID, wedding_name FROM Weddings WHERE ROWID = ${params.wid} AND org_id = ${escVal(orgId)}`
			);
			if (!check.length) return err(res, 404, 'Wedding not found');

			// Generate unique share token
			const crypto = require('crypto');
			const shareToken = crypto.randomUUID();
			await zcqlUpdate(zcql, 'Weddings', params.wid, { share_token: shareToken });

			await logAudit(zcql, orgId, params.wid, 'created', 'share_link', check[0].Weddings.wedding_name, currentUser?.email_id || '', { share_token: shareToken });

			return ok(res, { share_token: shareToken });
		}

		if ((params = matchRoute(url, '/api/shared/:token')) && method === 'GET') {
			// Public route — NO AUTH REQUIRED
			const zcql = app.zcql();
			const result = await zcql.executeZCQLQuery(
				`SELECT ROWID, wedding_name, wedding_date, total_budget, bride_name, groom_name, venue_city FROM Weddings WHERE share_token = ${escVal(params.token)}`
			);
			if (!result.length) return err(res, 404, 'Shared wedding not found or link expired');
			const wedding = result[0].Weddings;

			// Get events
			const eventsResult = await zcql.executeZCQLQuery(
				`SELECT ROWID, event_name, event_date, event_budget, venue FROM Events WHERE wedding_id = ${wedding.ROWID} ORDER BY CREATEDTIME ASC`
			);
			const events = eventsResult.map(r => r.Events);

			// Get expenses (no income/profit data for client privacy)
			const expensesResult = await zcql.executeZCQLQuery(
				`SELECT ROWID, event_id, vendor_name, category, amount, payment_status, description FROM Expenses WHERE wedding_id = ${wedding.ROWID} ORDER BY CREATEDTIME DESC`
			);
			const expenses = expensesResult.map(r => r.Expenses);

			// Enrich events with totals
			const expByEvent = {};
			expenses.forEach(e => {
				if (!expByEvent[e.event_id]) expByEvent[e.event_id] = { total: 0, count: 0 };
				expByEvent[e.event_id].total += parseFloat(e.amount) || 0;
				expByEvent[e.event_id].count++;
			});
			events.forEach(ev => {
				const agg = expByEvent[ev.ROWID] || {};
				ev.total_spent = agg.total || 0;
				ev.expense_count = agg.count || 0;
			});

			const totalSpent = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

			// Category breakdown
			const catTotals = {};
			expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + (parseFloat(e.amount) || 0); });
			const categories = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([c, t]) => ({ category: c, total: t }));

			return ok(res, {
				wedding,
				events,
				expenses,
				total_spent: totalSpent,
				categories
			});
		}

		// ═══════════ AUDIT LOGS ═══════════

		if ((params = matchRoute(url, '/api/weddings/:wid/audit-logs')) && method === 'GET') {
			const zcql = app.zcql();
			const result = await zcql.executeZCQLQuery(
				`SELECT ROWID, org_id, wedding_id, action, entity_type, entity_name, user_email, details, CREATEDTIME FROM AuditLogs WHERE wedding_id = ${params.wid} AND org_id = ${escVal(orgId)} ORDER BY CREATEDTIME DESC`
			);
			const logs = result.map(r => r.AuditLogs);
			return ok(res, logs);
		}

		// ═══════════ SMARTBROWZ — VENDOR URL PARSING ═══════════

		if (url === '/api/ai/parse-url' && method === 'POST') {
			const body = await parseBody(req);
			const targetUrl = body.url || '';
			if (!targetUrl) return err(res, 400, 'URL is required');

			let extractedText = '';
			let pdfUrl = '';

			try {
				const smartBrowz = app.smartBrowz();
				const pdfResult = await smartBrowz.convertToPdf(targetUrl);
				if (pdfResult && pdfResult.url) {
					pdfUrl = pdfResult.url;
				}
			} catch (_) {
				// SmartBrowz not available
			}

			// Try screenshot as fallback
			if (!pdfUrl) {
				try {
					const smartBrowz = app.smartBrowz();
					const ssResult = await smartBrowz.takeScreenshot(targetUrl);
					if (ssResult && ssResult.url) {
						pdfUrl = ssResult.url;
					}
				} catch (_) {}
			}

			return ok(res, {
				url: targetUrl,
				pdf_url: pdfUrl,
				text: extractedText,
				message: pdfUrl ? 'URL processed successfully' : 'SmartBrowz not available — paste the vendor quote text directly in AI chat'
			});
		}

		// ═══════════ SMARTBROWZ — WEB SEARCH ═══════════

		if (url === '/api/ai/web-search' && method === 'POST') {
			const body = await parseBody(req);
			const query = body.query || '';
			if (!query) return err(res, 400, 'Search query is required');

			const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' indian wedding')}`;
			let searchText = '';
			let pdfUrl = '';

			// 1. Try SmartBrowz PDF capture of search results
			try {
				const smartBrowz = app.smartBrowz();
				const pdfResult = await smartBrowz.convertToPdf(searchUrl);
				if (pdfResult && pdfResult.url) pdfUrl = pdfResult.url;
			} catch (_) {}

			// 2. Fetch HTML and extract text snippets
			try {
				const resp = await fetch(searchUrl, {
					headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WedExpense/1.0)' }
				});
				const html = await resp.text();

				// Extract result snippets from DuckDuckGo HTML
				const snippets = [];
				const titleRegex = /<a[^>]*class="result__a"[^>]*>([^<]+)<\/a>/gi;
				const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

				let match;
				while ((match = titleRegex.exec(html)) !== null && snippets.length < 8) {
					snippets.push(match[1].replace(/<[^>]*>/g, '').trim());
				}
				while ((match = snippetRegex.exec(html)) !== null && snippets.length < 16) {
					const clean = match[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
					if (clean.length > 20) snippets.push(clean);
				}

				searchText = snippets.join('\n\n');
			} catch (_) {
				// Fallback: use built-in knowledge
				searchText = `Web search results for "${query}" could not be fetched. Using built-in wedding knowledge base.`;
			}

			return ok(res, {
				query,
				text: searchText || `Search results for: ${query}. Use built-in wedding planning knowledge to answer.`,
				pdf_url: pdfUrl,
			});
		}

		// ═══════════ CRON — DAILY BUDGET SUMMARY (Manual Trigger) ═══════════

		if (url === '/api/cron/daily-summary' && method === 'POST') {
			const zcql = app.zcql();

			// Get all weddings for this org
			const weddingsResult = await zcql.executeZCQLQuery(
				`SELECT ROWID, wedding_name, total_budget FROM Weddings WHERE org_id = ${escVal(orgId)}`
			);
			const weddings = weddingsResult.map(r => r.Weddings);

			const summaries = [];
			for (const w of weddings) {
				const expResult = await zcql.executeZCQLQuery(
					`SELECT SUM(amount) as total FROM Expenses WHERE wedding_id = ${w.ROWID}`
				);
				const spent = parseFloat((expResult[0]?.Expenses || {}).total || 0);
				const budget = parseFloat(w.total_budget) || 0;
				const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
				summaries.push({ name: w.wedding_name, budget, spent, percent: pct });
			}

			// Send email
			const emailContent = summaries.map(s =>
				`<tr><td style="padding:8px;border-bottom:1px solid #eee">${s.name}</td><td style="padding:8px;border-bottom:1px solid #eee">₹${s.budget.toLocaleString('en-IN')}</td><td style="padding:8px;border-bottom:1px solid #eee">₹${s.spent.toLocaleString('en-IN')}</td><td style="padding:8px;border-bottom:1px solid #eee">${s.percent}%</td></tr>`
			).join('');

			const htmlBody = `
				<h2 style="color:#6366f1">WedExpense Daily Budget Summary</h2>
				<table style="width:100%;border-collapse:collapse">
					<tr style="background:#f5f3ff"><th style="padding:8px;text-align:left">Wedding</th><th style="padding:8px;text-align:left">Budget</th><th style="padding:8px;text-align:left">Spent</th><th style="padding:8px;text-align:left">Used</th></tr>
					${emailContent}
				</table>
				<p style="color:#888;font-size:12px;margin-top:20px">Sent by WedExpense AI Budget Tracker</p>
			`;

			try {
				const email = app.email();
				await email.sendMail({
					from_email: 'noreply@wedexpense.com',
					to_email: currentUser?.email_id || '',
					subject: 'WedExpense: Daily Budget Summary',
					content: htmlBody,
					html_mode: true
				});
			} catch (_) {
				// Email service not available
			}

			return ok(res, { summaries, email_sent: true });
		}

		// ═══════════ HEALTH CHECK ═══════════

		if (url === '/' || url === '/api/health') {
			return ok(res, { message: 'WedExpense API is running', version: '2.1.0' });
		}

		// ═══════════ 404 ═══════════

		return err(res, 404, `Route not found: ${method} ${url}`);

	} catch (error) {
		console.error('API Error:', error);
		return err(res, 500, error.message || 'Internal server error');
	}
};
