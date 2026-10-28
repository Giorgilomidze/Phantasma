/* =========================================================================
   Ads Management - i18n.js
   English + Georgian dictionaries. The Georgian text is MACHINE-TRANSLATED
   and NOT proofread by a native speaker. Missing Georgian keys fall back to
   English. The chosen language is kept in localStorage ('ads_lang').
   ========================================================================= */
(function () {
  'use strict';

  var en = {
    'app.name': 'Ads Management',
    'common.skip': 'Skip to content', 'common.cancel': 'Cancel', 'common.close': 'Close', 'common.back': 'Back', 'common.next': 'Next',
    'common.all': 'All', 'common.allAccounts': 'All ad accounts', 'common.refresh': 'Refresh', 'common.retry': 'Try again', 'common.date': 'Date',
    'common.soon': 'Round 2', 'common.noImage': 'No image', 'common.perDay': ' / day',
    'common.errorTitle': 'Something went wrong', 'common.errorText': 'The data could not be loaded. Please try again.',
    'common.currencyNote': 'All money amounts are in Georgian lari (GEL, ₾).', 'common.currencyNoteOther': 'All money amounts are in {cur} (the currency of this ad account).',
    'gate.login.title': 'Please log in', 'gate.login.text': 'This private tool is only for signed-in users. Log in on your account page, then come back to this page.',
    'gate.login': 'Go to log in',
    'gate.denied.title': 'No access', 'gate.denied.text': 'This account is not on the list for this tool.',
    'gate.error.title': 'Could not check your login', 'gate.error.text': 'For safety the tool stays closed. Check your connection and try again.',
    'top.badge': 'Prototype / mock data', 'top.business': 'Business', 'top.account': 'Ad account', 'top.menu': 'Menu', 'top.lang': 'Switch language', 'top.user': 'Account menu',
    'menu.back': 'Back to site', 'menu.signout': 'Sign out', 'menu.reset': 'Reset demo data',
    'reset.title': 'Reset demo data?', 'reset.text': 'All campaigns, posts and audit entries you changed in this demo go back to the starting mock data.', 'reset.confirm': 'Reset', 'reset.done': 'Demo data reset.',
    'nav.label': 'Main navigation', 'nav.dashboard': 'Dashboard', 'nav.campaigns': 'Campaigns', 'nav.posts': 'Posts', 'nav.images': 'Image Library', 'nav.products': 'Products', 'nav.rotation': 'Rotation', 'nav.settings': 'Settings', 'nav.audit': 'Audit log',
    'soon.title': 'Coming in round 2', 'soon.text': 'This screen is planned for the next round. Nothing is lost: everything you do in the tool is already being recorded.',
    'status.draft': 'Draft', 'status.paused': 'Paused', 'status.in_review': 'In review', 'status.active': 'Active', 'status.rejected': 'Rejected', 'status.ended': 'Ended',
    'status.needs_approval': 'Needs approval', 'status.approved': 'Approved', 'status.scheduled': 'Scheduled', 'status.published': 'Published',
    'col.name': 'Name', 'col.status': 'Status', 'col.budget': 'Budget', 'col.spend': 'Spend', 'col.messages': 'Messages', 'col.cpm': 'Cost per message', 'col.actions': 'Actions',
    'dash.range': 'Date range', 'dash.days': 'Last {n} days', 'dash.reach': 'Reach', 'dash.active': 'Active campaigns', 'dash.refreshed': 'Dashboard refreshed.',
    'dash.updated': 'Last {n} days. Updated {time}. Mock numbers.', 'dash.chartTitle': 'Spend and messages per day', 'dash.chartAria': 'Line chart of daily spend and messages',
    'dash.spendAxis': 'Spend ({cur}, left axis, solid line)', 'dash.msgAxis': 'Messages (right axis, dashed line)', 'dash.viewTable': 'View chart data as a table',
    'dash.campaigns': 'Campaigns', 'dash.noCampaigns': 'No campaign activity in this period.', 'dash.alerts': 'Alerts', 'dash.noAlerts': 'No alerts.',
    'alert.ok': 'Good', 'alert.watch': 'Watch', 'alert.act': 'Action needed',
    'camp.new': 'New campaign', 'camp.search': 'Search campaigns', 'camp.statusFilter': 'Filter by status', 'camp.totalShort': '{total} total over {days} days',
    'camp.emptyTitle': 'No campaigns found', 'camp.emptyText': 'Change the filters, or create a new campaign.',
    'act.pause': 'Pause', 'act.switchOn': 'Switch on', 'act.end': 'End', 'act.duplicate': 'Duplicate', 'act.results': 'Open results', 'act.toPaused': 'Move to paused',
    'toast.campaign.paused': 'Paused: {name}', 'toast.campaign.in_review': 'Sent for review: {name}. The mock review takes about 15 seconds.', 'toast.campaign.ended': 'Ended: {name}',
    'toast.duplicated': 'Campaign duplicated as a draft.', 'toast.created': 'Campaign created as paused. Nothing is spent yet.', 'toast.failed': 'That did not work.',
    'toast.saved': 'Draft saved.', 'toast.deleted': 'Post deleted.',
    'toast.post.needs_approval': 'Sent for approval.', 'toast.post.approved': 'Approved.', 'toast.post.scheduled': 'Scheduled.', 'toast.post.published': 'Published (mock: nothing was really posted).', 'toast.post.draft': 'Back to draft.',
    'end.title': 'End this campaign?', 'end.text': '"{name}" will stop for good. An ended campaign cannot be restarted.',
    'on.title': 'Switch on this campaign', 'on.warn': 'Switching on starts spending money from your ad account (in this prototype: mock money).',
    'on.risk': 'Policy warning: the caption has risky words ({words}). Meta may reject it.', 'on.type': 'Type the total budget ({amount}) to confirm',
    'on.hint': 'Type only the number, for example {amount}.', 'on.confirm': 'Switch on and allow up to {total}',
    'res.title': 'Results: {name}', 'res.note': 'Mock numbers, last 30 days.', 'res.none': 'No spend yet. Switch the campaign on to see results.',
    'wiz.title': 'New campaign', 'wiz.steps': 'Steps', 'wiz.s1': 'Goal', 'wiz.s2': 'Audience', 'wiz.s3': 'Budget and schedule', 'wiz.s4': 'Creative', 'wiz.s5': 'Review',
    'wiz.name': 'Campaign name', 'wiz.account': 'Ad account', 'wiz.goal': 'Goal', 'wiz.location': 'Location', 'wiz.ageMin': 'Age from', 'wiz.ageMax': 'Age to', 'wiz.age': 'Age', 'wiz.gender': 'Gender',
    'wiz.daily': 'Daily budget ({cur})', 'wiz.dailyHint': 'What you are willing to spend per day.', 'wiz.days': 'Number of days', 'wiz.start': 'Start date', 'wiz.total': 'Total budget', 'wiz.totalCost': 'Total cost (daily budget x days)',
    'wiz.limits': 'Allowed: {min} to {max} per day, up to {days} days.',
    'wiz.post': 'Use an existing post', 'wiz.noPost': 'No post, use images', 'wiz.postHint': 'Only approved, scheduled or published posts can be used.', 'wiz.images': 'Images', 'wiz.caption': 'Caption',
    'wiz.create': 'Create as paused', 'wiz.pausedNote': 'The campaign is created PAUSED. No money is spent until you switch it on and confirm the amount.', 'wiz.riskWarn': 'The caption contains risky words. You can still create the campaign, but Meta may reject it.',
    'goal.messages': 'Messages', 'goal.messages.d': 'People write to you on Messenger.', 'goal.traffic': 'Traffic', 'goal.traffic.d': 'People visit your website.', 'goal.engagement': 'Engagement', 'goal.engagement.d': 'Likes, comments and shares.',
    'gender.all': 'All', 'gender.women': 'Women', 'gender.men': 'Men',
    'err.name': 'Enter a campaign name.', 'err.account': 'Choose an ad account.', 'err.age': 'Age must be between 18 and 65, and "from" cannot be above "to".',
    'err.budget': 'Daily budget is outside the allowed range.', 'err.days': 'Days must be a whole number within the allowed range.', 'err.creative': 'Choose a post or at least one image.', 'err.caption': 'Write a caption.',
    'posts.list': 'List', 'posts.calendar': 'Calendar', 'posts.view': 'View', 'posts.new': 'New post', 'posts.noCaption': '(no caption)', 'posts.noDate': 'no date',
    'posts.emptyTitle': 'No posts found', 'posts.emptyText': 'Change the filter, or write a new post.',
    'cal.prev': 'Previous', 'cal.next': 'Next', 'cal.today': 'Today', 'cal.undated': 'Posts without a date',
    'comp.title': 'Post', 'comp.back': 'All posts', 'comp.product': 'Product', 'comp.noProduct': 'No product', 'comp.template': 'Georgian template', 'comp.count': '{n} / {max} characters (recommended maximum)',
    'comp.preview': 'Facebook preview (mock)', 'comp.save': 'Save draft', 'comp.send': 'Send for approval', 'comp.approve': 'Approve', 'comp.publish': 'Publish now', 'comp.schedule': 'Schedule',
    'comp.toDraft': 'Back to draft', 'comp.unschedule': 'Unschedule', 'comp.delete': 'Delete', 'comp.locked': 'Only drafts can be edited. Use "Back to draft" to change this post.',
    'comp.cost': 'Cost: 0 {cur}. This is an organic post, no ad money is spent.', 'comp.when': 'Publish on', 'comp.riskWarn': 'Policy warning: risky words found ({words}).', 'comp.ack': 'I have read the warning and still want to continue',
    'dlg.approve': 'Approve this post', 'dlg.approve.warn': 'Please check the exact content below. Approving does not publish it.',
    'dlg.publish': 'Publish this post now', 'dlg.publish.warn': 'This is exactly what will be posted on the Facebook page (in this prototype nothing is really posted).',
    'dlg.schedule': 'Schedule this post', 'dlg.schedule.warn': 'This exact content will be posted at the time you choose.',
    'del.title': 'Delete this post?', 'del.text': 'The post is removed from the tool. This cannot be undone.',
    'prev.meta': 'Just now - Public', 'prev.empty': 'Your caption appears here.', 'prev.like': 'Like', 'prev.comment': 'Comment', 'prev.share': 'Share',
    'policy.title': 'Policy check', 'policy.ok': 'No risky words found.', 'policy.found': '{n} risky word(s) found:',
    'ai.title': 'AI Assistant', 'ai.note': 'Mock assistant. It only suggests. Nothing happens until you press Approve on a card.', 'ai.hello': 'Hello! Ask me for a campaign, a post or a summary, or tap a suggestion.',
    'ai.input': 'Ask the assistant', 'ai.send': 'Send',
    'ai.chip1': 'Create a 2 {cur}/day campaign', 'ai.chip2': 'Draft a post', 'ai.chip3': 'Pause my active campaign', 'ai.chip4': 'How did we do this week?',
    'ai.campaign': 'Here is a small test campaign. Please check the money before you approve.', 'ai.campaignName': 'Assistant test - {biz}', 'ai.campaignCaption': 'Message us to book.',
    'ai.post': 'I wrote a draft post. It will be saved as a draft only.', 'ai.postCaption': 'Discover {product}. Message us to book.',
    'ai.pause': 'I can pause your first active campaign.', 'ai.noActive': 'You have no active campaign to pause.',
    'ai.stats': 'Last 7 days: spend {spend}, {msgs} messages, {cpm} per message, {active} active campaign(s). (Mock numbers.)',
    'ai.fallback': 'I can help with: creating a campaign, drafting a post, pausing a campaign, or a weekly summary.',
    'tool.createCampaign': 'Create campaign: {daily}/day, {days} days', 'tool.createPost': 'Create post (draft)', 'tool.pause': 'Pause campaign: {name}', 'tool.free': '0 {cur} (organic)',
    'tool.pausedNote': 'It is created paused. Nothing is spent until you switch it on yourself.', 'tool.approve': 'Approve', 'tool.reject': 'Reject', 'tool.edit': 'Edit',
    'tool.state.approved': 'Done.', 'tool.state.rejected': 'Rejected. Nothing was done.', 'tool.state.edited': 'Opened for editing.', 'tool.done': 'Done.',
    /* Live backend (Supabase Edge Functions) */
    'top.badge.mock': 'Mock data', 'top.badge.live': 'Live backend (dry-run)',
    'menu.modeLive': 'Use live backend (dry-run)', 'menu.modeMock': 'Use mock data',
    'mode.toLive.title': 'Switch to the live backend?', 'mode.toLive.text': 'Businesses and spending limits will come from the database, and "Create as paused" will call the server. While the server is in dry-run mode, nothing is sent to Meta. Campaign lists, posts and numbers stay sample data. The page will reload.',
    'mode.toLive.confirm': 'Switch to live backend', 'mode.toMock.title': 'Switch back to mock data?', 'mode.toMock.text': 'Everything will be sample data again. The page will reload.', 'mode.toMock.confirm': 'Use mock data',
    'mode.liveNote': 'Live backend: businesses and spending limits are real. Campaign lists, posts and numbers on this page are still sample data.',
    'mode.liveFailed': 'Could not load the live data (is this login a member of Ads Management?). Showing mock data instead.',
    'health.btn': 'Test Meta connection', 'health.title': 'Meta connection', 'health.running': 'Checking the connection...',
    'health.okText': 'The connection works.', 'health.problems': 'Problems found', 'health.account': 'Ad account', 'health.status': 'Status', 'health.currency': 'Currency',
    'health.page': 'Facebook Page', 'health.mode': 'Server mode', 'health.dry': 'Dry-run: nothing is sent to Meta', 'health.liveOn': 'LIVE: campaigns are really created at Meta (paused)', 'health.none': 'not available',
    'wiz.postObj': 'Facebook post ID', 'wiz.postObjHint': 'The ad uses a post that already exists on your Facebook Page. Open that post, copy its ID (it looks like 155011827684882_1234567890) and paste it here.',
    'wiz.limitsLive': 'Limits set by the owner: up to {max} per day, up to {total} per campaign, up to {days} days.',
    'wiz.liveNote': 'Live backend: the server checks the limits again. Location is set to Georgia; gender, start date, caption and images are not sent (the ad is built from the existing post).',
    'err.postObj': 'Enter the Facebook post ID, like 155011827684882_1234567890.', 'err.total': 'The total (daily budget x days) is over the limit of {total}.',
    'res.dry.title': 'DRY RUN: nothing was sent to Meta', 'res.dry.text': 'The server checked everything and built the exact requests below. Nothing was created at Meta and no money was spent. Everything would be created PAUSED.',
    'res.live.title': 'Campaign created at Meta (paused)', 'res.live.text': 'Everything was created PAUSED. No money is spent until a campaign is switched on.',
    'res.account': 'Ad account', 'res.api': 'Meta API version', 'res.total': 'Total budget', 'res.ids': 'Meta IDs', 'res.payloads': 'Requests that would be sent',
    'res.p.campaign': 'Campaign', 'res.p.adset': 'Ad set', 'res.p.creative': 'Creative', 'res.p.ad': 'Ad', 'res.step': 'Stopped at step',
    'srv.title': 'The server did not accept this', 'srv.hint': 'Anything already created is PAUSED. Try again with the same details to continue.',
    'srv.network': 'Could not reach the server. Check your connection and try again.', 'srv.access': 'You are not allowed to use Ads Management on the server, or your login expired. Sign in again or ask the owner.',
    'srv.over_daily_cap': 'Daily budget is over the limit.', 'srv.over_total_cap': 'Total budget is over the limit.', 'srv.over_days_cap': 'Too many days.', 'srv.meta_error': 'Meta refused the request.',
    'srv.in_progress': 'This request is already being processed. Wait a moment and try again.', 'srv.default': 'The server refused the request.'
  };

  var ka = {
    'app.name': 'რეკლამების მართვა',
    'common.skip': 'გადასვლა შინაარსზე', 'common.cancel': 'გაუქმება', 'common.close': 'დახურვა', 'common.back': 'უკან', 'common.next': 'შემდეგი',
    'common.all': 'ყველა', 'common.allAccounts': 'ყველა სარეკლამო ანგარიში', 'common.refresh': 'განახლება', 'common.retry': 'სცადეთ ხელახლა', 'common.date': 'თარიღი',
    'common.soon': 'ეტაპი 2', 'common.noImage': 'სურათის გარეშე', 'common.perDay': ' / დღე',
    'common.errorTitle': 'რაღაც შეცდომა მოხდა', 'common.errorText': 'მონაცემები ვერ ჩაიტვირთა. გთხოვთ, სცადოთ ხელახლა.',
    'common.currencyNote': 'ყველა თანხა მითითებულია ქართულ ლარში (GEL, ₾).', 'common.currencyNoteOther': 'ყველა თანხა მითითებულია ვალუტაში {cur} (ამ სარეკლამო ანგარიშის ვალუტა).',
    'gate.login.title': 'გთხოვთ, შეხვიდეთ სისტემაში', 'gate.login.text': 'ეს კერძო ხელსაწყო მხოლოდ ავტორიზებული მომხმარებლებისთვისაა. შედით თქვენს ანგარიშზე და შემდეგ დაბრუნდით ამ გვერდზე.',
    'gate.login': 'შესვლის გვერდზე გადასვლა',
    'gate.denied.title': 'წვდომა არ გაქვთ', 'gate.denied.text': 'ეს ანგარიში ამ ხელსაწყოს სიაში არ არის.',
    'gate.error.title': 'შესვლის შემოწმება ვერ მოხერხდა', 'gate.error.text': 'უსაფრთხოების გამო ხელსაწყო დახურულია. შეამოწმეთ კავშირი და სცადეთ ხელახლა.',
    'top.badge': 'პროტოტიპი / სატესტო მონაცემები', 'top.business': 'ბიზნესი', 'top.account': 'სარეკლამო ანგარიში', 'top.menu': 'მენიუ', 'top.lang': 'ენის შეცვლა', 'top.user': 'ანგარიშის მენიუ',
    'menu.back': 'საიტზე დაბრუნება', 'menu.signout': 'გასვლა', 'menu.reset': 'დემო მონაცემების განულება',
    'reset.title': 'დემო მონაცემების განულება?', 'reset.text': 'ყველა ცვლილება კამპანიებში, პოსტებსა და ჟურნალში დაუბრუნდება საწყის სატესტო მონაცემებს.', 'reset.confirm': 'განულება', 'reset.done': 'დემო მონაცემები განულდა.',
    'nav.label': 'მთავარი ნავიგაცია', 'nav.dashboard': 'მთავარი პანელი', 'nav.campaigns': 'კამპანიები', 'nav.posts': 'პოსტები', 'nav.images': 'სურათების ბიბლიოთეკა', 'nav.products': 'პროდუქტები', 'nav.rotation': 'როტაცია', 'nav.settings': 'პარამეტრები', 'nav.audit': 'ქმედებების ჟურნალი',
    'soon.title': 'მალე, მე-2 ეტაპზე', 'soon.text': 'ეს გვერდი შემდეგ ეტაპზეა დაგეგმილი. არაფერი იკარგება: ყველა თქვენი ქმედება უკვე ჩაიწერება.',
    'status.draft': 'დრაფტი', 'status.paused': 'შეჩერებული', 'status.in_review': 'განხილვაში', 'status.active': 'აქტიური', 'status.rejected': 'უარყოფილი', 'status.ended': 'დასრულებული',
    'status.needs_approval': 'საჭიროებს დამტკიცებას', 'status.approved': 'დამტკიცებული', 'status.scheduled': 'დაგეგმილი', 'status.published': 'გამოქვეყნებული',
    'col.name': 'სახელი', 'col.status': 'სტატუსი', 'col.budget': 'ბიუჯეტი', 'col.spend': 'ხარჯი', 'col.messages': 'შეტყობინებები', 'col.cpm': 'ფასი ერთ შეტყობინებაზე', 'col.actions': 'მოქმედებები',
    'dash.range': 'პერიოდი', 'dash.days': 'ბოლო {n} დღე', 'dash.reach': 'მიღწევა', 'dash.active': 'აქტიური კამპანიები', 'dash.refreshed': 'პანელი განახლდა.',
    'dash.updated': 'ბოლო {n} დღე. განახლდა {time}. სატესტო რიცხვები.', 'dash.chartTitle': 'ხარჯი და შეტყობინებები დღეების მიხედვით', 'dash.chartAria': 'ყოველდღიური ხარჯისა და შეტყობინებების გრაფიკი',
    'dash.spendAxis': 'ხარჯი ({cur}, მარცხენა ღერძი, უწყვეტი ხაზი)', 'dash.msgAxis': 'შეტყობინებები (მარჯვენა ღერძი, წყვეტილი ხაზი)', 'dash.viewTable': 'გრაფიკის მონაცემები ცხრილად',
    'dash.campaigns': 'კამპანიები', 'dash.noCampaigns': 'ამ პერიოდში კამპანიების აქტივობა არ არის.', 'dash.alerts': 'შეტყობინებები', 'dash.noAlerts': 'გაფრთხილებები არ არის.',
    'alert.ok': 'კარგი', 'alert.watch': 'ყურადღება', 'alert.act': 'საჭიროა მოქმედება',
    'camp.new': 'ახალი კამპანია', 'camp.search': 'კამპანიების ძიება', 'camp.statusFilter': 'ფილტრი სტატუსით', 'camp.totalShort': 'სულ {total} {days} დღეში',
    'camp.emptyTitle': 'კამპანიები ვერ მოიძებნა', 'camp.emptyText': 'შეცვალეთ ფილტრები ან შექმენით ახალი კამპანია.',
    'act.pause': 'შეჩერება', 'act.switchOn': 'ჩართვა', 'act.end': 'დასრულება', 'act.duplicate': 'დუბლირება', 'act.results': 'შედეგების ნახვა', 'act.toPaused': 'შეჩერებულში გადატანა',
    'toast.campaign.paused': 'შეჩერდა: {name}', 'toast.campaign.in_review': 'გაიგზავნა განსახილველად: {name}. სატესტო განხილვა დაახლოებით 15 წამს გრძელდება.', 'toast.campaign.ended': 'დასრულდა: {name}',
    'toast.duplicated': 'კამპანია დუბლირდა დრაფტად.', 'toast.created': 'კამპანია შეიქმნა შეჩერებულად. თანხა ჯერ არ იხარჯება.', 'toast.failed': 'ვერ შესრულდა.',
    'toast.saved': 'დრაფტი შენახულია.', 'toast.deleted': 'პოსტი წაიშალა.',
    'toast.post.needs_approval': 'გაიგზავნა დასამტკიცებლად.', 'toast.post.approved': 'დამტკიცდა.', 'toast.post.scheduled': 'დაიგეგმა.', 'toast.post.published': 'გამოქვეყნდა (ტესტი: რეალურად არაფერი გამოქვეყნებულა).', 'toast.post.draft': 'დაბრუნდა დრაფტში.',
    'end.title': 'კამპანიის დასრულება?', 'end.text': '"{name}" სამუდამოდ შეჩერდება. დასრულებული კამპანიის ხელახლა გაშვება შეუძლებელია.',
    'on.title': 'კამპანიის ჩართვა', 'on.warn': 'ჩართვის შემდეგ თქვენი სარეკლამო ანგარიშიდან თანხა დაიხარჯება (ამ პროტოტიპში: სატესტო თანხა).',
    'on.risk': 'პოლიტიკის გაფრთხილება: ტექსტში რისკიანი სიტყვებია ({words}). Meta-მ შეიძლება უარყოს.', 'on.type': 'დასადასტურებლად ჩაწერეთ მთლიანი ბიუჯეტი ({amount})',
    'on.hint': 'ჩაწერეთ მხოლოდ რიცხვი, მაგალითად {amount}.', 'on.confirm': 'ჩართვა და {total}-მდე დახარჯვის დაშვება',
    'res.title': 'შედეგები: {name}', 'res.note': 'სატესტო რიცხვები, ბოლო 30 დღე.', 'res.none': 'ხარჯი ჯერ არ არის. ჩართეთ კამპანია შედეგების სანახავად.',
    'wiz.title': 'ახალი კამპანია', 'wiz.steps': 'ნაბიჯები', 'wiz.s1': 'მიზანი', 'wiz.s2': 'აუდიტორია', 'wiz.s3': 'ბიუჯეტი და გრაფიკი', 'wiz.s4': 'კრეატივი', 'wiz.s5': 'გადახედვა',
    'wiz.name': 'კამპანიის სახელი', 'wiz.account': 'სარეკლამო ანგარიში', 'wiz.goal': 'მიზანი', 'wiz.location': 'ლოკაცია', 'wiz.ageMin': 'ასაკი-დან', 'wiz.ageMax': 'ასაკი-მდე', 'wiz.age': 'ასაკი', 'wiz.gender': 'სქესი',
    'wiz.daily': 'დღიური ბიუჯეტი ({cur})', 'wiz.dailyHint': 'რამდენის დახარჯვა გსურთ დღეში.', 'wiz.days': 'დღეების რაოდენობა', 'wiz.start': 'დაწყების თარიღი', 'wiz.total': 'მთლიანი ბიუჯეტი', 'wiz.totalCost': 'საერთო ღირებულება (დღიური ბიუჯეტი x დღეები)',
    'wiz.limits': 'დაშვებულია: {min}-დან {max}-მდე დღეში, მაქსიმუმ {days} დღე.',
    'wiz.post': 'არსებული პოსტის გამოყენება', 'wiz.noPost': 'პოსტის გარეშე, სურათებით', 'wiz.postHint': 'გამოიყენება მხოლოდ დამტკიცებული, დაგეგმილი ან გამოქვეყნებული პოსტები.', 'wiz.images': 'სურათები', 'wiz.caption': 'ტექსტი',
    'wiz.create': 'შექმნა შეჩერებულად', 'wiz.pausedNote': 'კამპანია იქმნება შეჩერებულად. თანხა არ დაიხარჯება, სანამ არ ჩართავთ და თანხას არ დაადასტურებთ.', 'wiz.riskWarn': 'ტექსტში რისკიანი სიტყვებია. კამპანიის შექმნა მაინც შეგიძლიათ, მაგრამ Meta-მ შეიძლება უარყოს.',
    'goal.messages': 'შეტყობინებები', 'goal.messages.d': 'ადამიანები გწერენ Messenger-ში.', 'goal.traffic': 'ტრაფიკი', 'goal.traffic.d': 'ადამიანები სტუმრობენ თქვენს საიტს.', 'goal.engagement': 'ჩართულობა', 'goal.engagement.d': 'მოწონებები, კომენტარები და გაზიარებები.',
    'gender.all': 'ყველა', 'gender.women': 'ქალები', 'gender.men': 'კაცები',
    'err.name': 'შეიყვანეთ კამპანიის სახელი.', 'err.account': 'აირჩიეთ სარეკლამო ანგარიში.', 'err.age': 'ასაკი უნდა იყოს 18-დან 65-მდე, "დან" არ უნდა აღემატებოდეს "მდე"-ს.',
    'err.budget': 'დღიური ბიუჯეტი დაშვებულ დიაპაზონს სცდება.', 'err.days': 'დღეები უნდა იყოს მთელი რიცხვი დაშვებულ დიაპაზონში.', 'err.creative': 'აირჩიეთ პოსტი ან მინიმუმ ერთი სურათი.', 'err.caption': 'დაწერეთ ტექსტი.',
    'posts.list': 'სია', 'posts.calendar': 'კალენდარი', 'posts.view': 'ხედი', 'posts.new': 'ახალი პოსტი', 'posts.noCaption': '(ტექსტის გარეშე)', 'posts.noDate': 'თარიღის გარეშე',
    'posts.emptyTitle': 'პოსტები ვერ მოიძებნა', 'posts.emptyText': 'შეცვალეთ ფილტრი ან დაწერეთ ახალი პოსტი.',
    'cal.prev': 'წინა', 'cal.next': 'შემდეგი', 'cal.today': 'დღეს', 'cal.undated': 'თარიღის გარეშე პოსტები',
    'comp.title': 'პოსტი', 'comp.back': 'ყველა პოსტი', 'comp.product': 'პროდუქტი', 'comp.noProduct': 'პროდუქტის გარეშე', 'comp.template': 'ქართული შაბლონი', 'comp.count': '{n} / {max} სიმბოლო (რეკომენდებული მაქსიმუმი)',
    'comp.preview': 'Facebook-ის გადახედვა (ტესტი)', 'comp.save': 'დრაფტის შენახვა', 'comp.send': 'დასამტკიცებლად გაგზავნა', 'comp.approve': 'დამტკიცება', 'comp.publish': 'ახლა გამოქვეყნება', 'comp.schedule': 'დაგეგმვა',
    'comp.toDraft': 'დრაფტში დაბრუნება', 'comp.unschedule': 'დაგეგმვის გაუქმება', 'comp.delete': 'წაშლა', 'comp.locked': 'რედაქტირება მხოლოდ დრაფტს შეუძლია. შესაცვლელად გამოიყენეთ "დრაფტში დაბრუნება".',
    'comp.cost': 'ღირებულება: 0 {cur}. ეს ორგანული პოსტია, სარეკლამო თანხა არ იხარჯება.', 'comp.when': 'გამოქვეყნების დრო', 'comp.riskWarn': 'პოლიტიკის გაფრთხილება: ნაპოვნია რისკიანი სიტყვები ({words}).', 'comp.ack': 'გაფრთხილება წავიკითხე და მაინც გავაგრძელებ',
    'dlg.approve': 'პოსტის დამტკიცება', 'dlg.approve.warn': 'გთხოვთ, შეამოწმოთ ქვემოთ მოცემული ზუსტი შინაარსი. დამტკიცება არ ნიშნავს გამოქვეყნებას.',
    'dlg.publish': 'პოსტის ახლავე გამოქვეყნება', 'dlg.publish.warn': 'ზუსტად ეს გამოქვეყნდება Facebook-ის გვერდზე (ამ პროტოტიპში რეალურად არაფერი ქვეყნდება).',
    'dlg.schedule': 'პოსტის დაგეგმვა', 'dlg.schedule.warn': 'ზუსტად ეს შინაარსი გამოქვეყნდება თქვენ მიერ არჩეულ დროს.',
    'del.title': 'პოსტის წაშლა?', 'del.text': 'პოსტი ხელსაწყოდან წაიშლება. ამის გაუქმება შეუძლებელია.',
    'prev.meta': 'ახლახან - საჯარო', 'prev.empty': 'თქვენი ტექსტი აქ გამოჩნდება.', 'prev.like': 'მოწონება', 'prev.comment': 'კომენტარი', 'prev.share': 'გაზიარება',
    'policy.title': 'პოლიტიკის შემოწმება', 'policy.ok': 'რისკიანი სიტყვები არ მოიძებნა.', 'policy.found': 'ნაპოვნია რისკიანი სიტყვა: {n}',
    'ai.title': 'AI ასისტენტი', 'ai.note': 'სატესტო ასისტენტი. ის მხოლოდ გირჩევთ. არაფერი ხდება, სანამ ბარათზე "დამტკიცებას" არ დააჭერთ.', 'ai.hello': 'გამარჯობა! მთხოვეთ კამპანია, პოსტი ან მიმოხილვა, ან აირჩიეთ შემოთავაზება.',
    'ai.input': 'ჰკითხეთ ასისტენტს', 'ai.send': 'გაგზავნა',
    'ai.chip1': 'შექმენი კამპანია 2 {cur}/დღე', 'ai.chip2': 'დაწერე პოსტი', 'ai.chip3': 'შეაჩერე ჩემი აქტიური კამპანია', 'ai.chip4': 'როგორ ვიყავით ამ კვირაში?',
    'ai.campaign': 'აი მცირე სატესტო კამპანია. დამტკიცებამდე გთხოვთ, შეამოწმოთ თანხა.', 'ai.campaignName': 'ასისტენტის ტესტი - {biz}', 'ai.campaignCaption': 'დაჯავშნისთვის მოგვწერეთ.',
    'ai.post': 'დავწერე პოსტის დრაფტი. ის მხოლოდ დრაფტად შეინახება.', 'ai.postCaption': 'გაიცანით: {product}. დაჯავშნისთვის მოგვწერეთ.',
    'ai.pause': 'შემიძლია შევაჩერო თქვენი პირველი აქტიური კამპანია.', 'ai.noActive': 'შესაჩერებელი აქტიური კამპანია არ გაქვთ.',
    'ai.stats': 'ბოლო 7 დღე: ხარჯი {spend}, შეტყობინებები {msgs}, ფასი ერთ შეტყობინებაზე {cpm}, აქტიური კამპანია {active}. (სატესტო რიცხვები.)',
    'ai.fallback': 'შემიძლია დაგეხმაროთ: კამპანიის შექმნაში, პოსტის დაწერაში, კამპანიის შეჩერებასა და კვირის მიმოხილვაში.',
    'tool.createCampaign': 'კამპანიის შექმნა: {daily}/დღე, {days} დღე', 'tool.createPost': 'პოსტის შექმნა (დრაფტი)', 'tool.pause': 'კამპანიის შეჩერება: {name}', 'tool.free': '0 {cur} (ორგანული)',
    'tool.pausedNote': 'იქმნება შეჩერებული. თანხა არ დაიხარჯება, სანამ თავად არ ჩართავთ.', 'tool.approve': 'დამტკიცება', 'tool.reject': 'უარყოფა', 'tool.edit': 'რედაქტირება',
    'tool.state.approved': 'შესრულდა.', 'tool.state.rejected': 'უარყოფილია. არაფერი გაკეთებულა.', 'tool.state.edited': 'გაიხსნა რედაქტირებისთვის.', 'tool.done': 'შესრულდა.',
    /* Live backend. MACHINE-TRANSLATED, not proofread. Server messages stay in English. */
    'top.badge.mock': 'სატესტო მონაცემები', 'top.badge.live': 'რეალური ბექენდი (ტესტური გაშვება)',
    'menu.modeLive': 'რეალური ბექენდის გამოყენება (ტესტური გაშვება)', 'menu.modeMock': 'სატესტო მონაცემების გამოყენება',
    'mode.toLive.title': 'გადავიდეთ რეალურ ბექენდზე?', 'mode.toLive.text': 'ბიზნესები და ხარჯვის ლიმიტები ბაზიდან წამოვა, ხოლო „შექმნა შეჩერებულად“ სერვერს გამოიძახებს. სანამ სერვერი ტესტური გაშვების რეჟიმშია, Meta-ში არაფერი იგზავნება. კამპანიების სია, პოსტები და ციფრები სატესტო რჩება. გვერდი თავიდან ჩაიტვირთება.',
    'mode.toLive.confirm': 'რეალურ ბექენდზე გადასვლა', 'mode.toMock.title': 'დავბრუნდეთ სატესტო მონაცემებზე?', 'mode.toMock.text': 'ყველაფერი ისევ სატესტო იქნება. გვერდი თავიდან ჩაიტვირთება.', 'mode.toMock.confirm': 'სატესტო მონაცემების გამოყენება',
    'mode.liveNote': 'რეალური ბექენდი: ბიზნესები და ხარჯვის ლიმიტები რეალურია. კამპანიების სია, პოსტები და ციფრები ამ გვერდზე ჯერ სატესტოა.',
    'mode.liveFailed': 'რეალური მონაცემები ვერ ჩაიტვირთა (ეს ანგარიში Ads Management-ის წევრია?). ნაჩვენებია სატესტო მონაცემები.',
    'health.btn': 'Meta-სთან კავშირის შემოწმება', 'health.title': 'Meta-სთან კავშირი', 'health.running': 'კავშირი მოწმდება...',
    'health.okText': 'კავშირი მუშაობს.', 'health.problems': 'ნაპოვნია პრობლემები', 'health.account': 'სარეკლამო ანგარიში', 'health.status': 'სტატუსი', 'health.currency': 'ვალუტა',
    'health.page': 'Facebook გვერდი', 'health.mode': 'სერვერის რეჟიმი', 'health.dry': 'ტესტური გაშვება: Meta-ში არაფერი იგზავნება', 'health.liveOn': 'რეალური: კამპანიები Meta-ში ნამდვილად იქმნება (შეჩერებული)', 'health.none': 'მიუწვდომელია',
    'wiz.postObj': 'Facebook პოსტის ID', 'wiz.postObjHint': 'რეკლამა იყენებს პოსტს, რომელიც უკვე არსებობს თქვენს Facebook გვერდზე. გახსენით ეს პოსტი, დააკოპირეთ მისი ID (ასე გამოიყურება: 155011827684882_1234567890) და ჩასვით აქ.',
    'wiz.limitsLive': 'მფლობელის დაწესებული ლიმიტები: დღეში მაქსიმუმ {max}, კამპანიაზე მაქსიმუმ {total}, მაქსიმუმ {days} დღე.',
    'wiz.liveNote': 'რეალური ბექენდი: სერვერი ლიმიტებს თავიდან ამოწმებს. ლოკაცია არის საქართველო; სქესი, დაწყების თარიღი, ტექსტი და სურათები არ იგზავნება (რეკლამა არსებული პოსტიდან იგება).',
    'err.postObj': 'შეიყვანეთ Facebook პოსტის ID, მაგალითად 155011827684882_1234567890.', 'err.total': 'ჯამი (დღიური ბიუჯეტი x დღეები) ლიმიტს {total} აღემატება.',
    'res.dry.title': 'ტესტური გაშვება: Meta-ში არაფერი გაიგზავნა', 'res.dry.text': 'სერვერმა ყველაფერი შეამოწმა და ქვემოთ ზუსტი მოთხოვნები ააგო. Meta-ში არაფერი შექმნილა და თანხა არ დახარჯულა. ყველაფერი შეჩერებული შეიქმნებოდა.',
    'res.live.title': 'კამპანია Meta-ში შეიქმნა (შეჩერებული)', 'res.live.text': 'ყველაფერი შეჩერებული შეიქმნა. თანხა არ დაიხარჯება, სანამ კამპანიას არ ჩართავთ.',
    'res.account': 'სარეკლამო ანგარიში', 'res.api': 'Meta API ვერსია', 'res.total': 'მთლიანი ბიუჯეტი', 'res.ids': 'Meta ID-ები', 'res.payloads': 'მოთხოვნები, რომლებიც გაიგზავნებოდა',
    'res.p.campaign': 'კამპანია', 'res.p.adset': 'რეკლამების ჯგუფი', 'res.p.creative': 'კრეატივი', 'res.p.ad': 'რეკლამა', 'res.step': 'გაჩერდა ეტაპზე',
    'srv.title': 'სერვერმა ეს არ მიიღო', 'srv.hint': 'რაც უკვე შეიქმნა, შეჩერებულია. გააგრძელეთ იგივე მონაცემებით ხელახლა ცდით.',
    'srv.network': 'სერვერთან დაკავშირება ვერ მოხერხდა. შეამოწმეთ კავშირი და სცადეთ ხელახლა.', 'srv.access': 'სერვერზე არ გაქვთ Ads Management-ის გამოყენების უფლება, ან შესვლა ამოიწურა. შედით ხელახლა ან მიმართეთ მფლობელს.',
    'srv.over_daily_cap': 'დღიური ბიუჯეტი ლიმიტს აღემატება.', 'srv.over_total_cap': 'მთლიანი ბიუჯეტი ლიმიტს აღემატება.', 'srv.over_days_cap': 'დღეები ზედმეტია.', 'srv.meta_error': 'Meta-მ მოთხოვნა უარყო.',
    'srv.in_progress': 'ეს მოთხოვნა უკვე მუშავდება. მოიცადეთ და სცადეთ ხელახლა.', 'srv.default': 'სერვერმა მოთხოვნა უარყო.'
  };

  var dict = { en: en, ka: ka };
  var lang = 'en';
  try { var s = localStorage.getItem('ads_lang'); if (s === 'en' || s === 'ka') lang = s; } catch (e) { /* private mode */ }
  document.documentElement.lang = lang;

  function t(key, vars) {
    var s = (dict[lang] && dict[lang][key]) || en[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }
  function setLang(l) {
    if (l !== 'en' && l !== 'ka') return;
    lang = l;
    document.documentElement.lang = l;
    try { localStorage.setItem('ads_lang', l); } catch (e) { /* ignore */ }
  }
  // Translate static markup: data-i18n (text), data-i18n-aria (aria-label), data-i18n-ph (placeholder)
  function apply(root) {
    [].forEach.call(root.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    [].forEach.call(root.querySelectorAll('[data-i18n-aria]'), function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    [].forEach.call(root.querySelectorAll('[data-i18n-ph]'), function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  }

  window.AdsI18n = { t: t, lang: function () { return lang; }, setLang: setLang, apply: apply, dict: dict };
})();
