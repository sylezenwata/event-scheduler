import "../auth";

import "../../css/e/schedule.css";

const SET = require("../set");
const FORM = require("../form");
const { notifier } = require("../mods");

/**
 * search resource
 */
SET.$('form#scheduleFilterForm').on('submit', e => {
    e.preventDefault();
    const filterInput = e.currentTarget.getElem('input[name=q]');
    const filterValue = filterInput.value;
    if (filterValue.trim().length > 0) {
        fetchSchedule(null,null,true,null,`/schedule/filter?q=${filterValue}`);
    }
});

/**
 * fetch schedules
 */
const scheduleCon = SET.$('#scheduleContainer');
const scheduleLoader = (loadingInfo = 'Loading schedules, please wait...') => {
    if (!loadingInfo) {
        return SET.removeElem(scheduleCon.getParent().getElem('#scheduleLoader'));
    }
    scheduleCon.getParent().appendElem(`<div id="scheduleLoader" class="m-t-20 p-tb-20 p-lr-10 flex flex-col align-c"><div class="f-14">${loadingInfo}</div></div>`);
}
function fetchSchedule(start = null, limit = null, empty = true, cb = null, url = '/schedule/fetch') {
    empty && scheduleCon.html();
    empty && SET.removeElem(scheduleCon.getParent().getElem('#moreSchedule'))
    scheduleLoader();
    let params = [`e=1`];
    start && params.push(`s=${start}`);
    limit && params.push(`l=${limit}`);
    SET.ajax({
        method: 'GET',
        url: SET.formatUrlParam(`${url}`, params),
        headers: {
            'Content-Type': false
        },
        handler: (res, err) => {
            scheduleLoader(null);
            if (err)
                return notifier(`${err.code ? err.code+': ' : ''}${err.msg}`,'error');
            const { error, errorMsg, data, force } = res;
            if (force) 
                return redirectFunc(force);
            if (error)
                return notifier(`${errorMsg}`,'error');
            if (data) {
                const {schedule, more} = data;
                if (schedule.length <= 0) {
                    if (!start) {
                        scheduleCon.html('<div class="m-t-20 p-tb-20 p-lr-10 flex flex-col align-c w-100"><div class="f-14">No schedule found</div></div>');
                    }
                } else {
                    schedule.forEach((eachData) => {
                        addToScheduleList(eachData);
                    });
                    if (more) {
                        scheduleCon.getParent().appendElem(`<div id="moreSchedule" class="m-t-20 p-tb-20 p-lr-10 flex flex-col align-c"><button class="btn" style="color: var(--text-color);">More schedules</button></div>`);
                        moreLoad(more);
                    }
                }
                cb && cb();
                return;
            }
            notifier('An error occurred processing request.','error');
        },
    });
}
function addToScheduleList(data) {
    let {id,event_name, event_color, event_location, event_date, event_desc, formatted_event_date, event_completed, user_notified} = data;
    event_completed = event_completed == 1 ? true : false;
    user_notified = user_notified == 1 ? true : false;
    let resourceItem = `<div class="sch-item__wrap" data-id="${id}">
        <div class="sch-item" style="border-top: 6px solid ${event_color};">
            <div class="sch-item__head flex align-c justify-b">
                <div class="status f-10 f-w-6 ${event_completed && user_notified ? 'success' : 'default'}">${event_completed && user_notified ? 'Completed' : (user_notified ? 'Notified' : 'In progress')}</div>
                <div style="padding: 0;">
                    <button type="button" class="btn icon stroke" onclick="dropDown(event);" data-dropdown="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" stroke-width="1.5" stroke="#000000" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </button>
                    <div class="drop-down b-rad-5 custom-scroll" style="width: 100px; top: 30px;" aria-hidden="true">
                        <ul class="p-tb-10">
                            <li class="hover-effect">
                                <a href="javascript:void(0);" onclick="delSchEvent(event)">
                                    <div class="f-w-6 f-14 text-icon text-cap text-c" style="padding: 5px 10px; color: var(--error-color);">Delete</div>
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="sch-item__body">
                <p class="f-16 f-w-6 text-cap">${event_name}</p>
                <div class="m-t-10 flex align-c">
                    <span class="icon stroke" style="padding: 0; height: 20px; width: 20px; margin-right: 5px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" stroke-width="1.5" stroke="#000000" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <circle cx="12" cy="11" r="3" />
                            <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" />
                        </svg>
                    </span>
                    <span style="color: var(--icon-color); max-width: calc(100% - 25px);" class="text-cap">${event_location}</span>
                </div>
                <div class="m-t-10 flex align-c">
                    <span class="icon stroke" style="padding: 0; height: 20px; width: 20px; margin-right: 5px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" stroke-width="1.5" stroke="#000000" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <path d="M11.795 21h-6.795a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v4" />
                            <circle cx="18" cy="18" r="4" />
                            <path d="M15 3v4" />
                            <path d="M7 3v4" />
                            <path d="M3 11h16" />
                            <path d="M18 16.496v1.504l1 1" />
                        </svg>
                    </span>
                    <span style="color: var(--icon-color); max-width: calc(100% - 25px);" class="text-cap">${formatted_event_date}</span>
                </div>
                <p class="m-t-10 f-12 text-mute">
                    ${event_desc}
                </p>
            </div>
        </div>
    </div>`;
    scheduleCon.appendElem(resourceItem);
}
function moreLoad(start) {
    const moreBtn = scheduleCon.getParent().getElem('#moreSchedule button');
    moreBtn.on('click', () => {
        SET.removeElem(moreBtn.getParent());
        fetchSchedule(start,null,false);
    });
}
// load schedules when page loads
window.on('DOMContentLoaded', () => {
    fetchSchedule();
});

/**
 * add new schedule
 */
const _form = new FORM();
const newSchedule = SET.$('#newSchedule');
const closeNewSchedule = SET.$('#closeNewSchedule');
const newScheduleForm = SET.$('#newScheduleForm');
/**
 * function to toggle new schedule modal
 * @returns void
 */
function toggleNewSchedule() {
    const newScheduleModal = SET.$('#newScheduleModal');
    if (newScheduleModal.style.display === 'none' || getComputedStyle(newScheduleModal).display === 'none') {
        SET.fixClass(['body'],[['no-overflow']],[true]);
        newScheduleModal.style.display = 'block';
        return;
    }
    SET.fixClass(['body'],[['no-overflow']],[false]);
    newScheduleModal.style.display = 'none';
    _form.reset('#newScheduleForm');
}
newSchedule.on('click', toggleNewSchedule);
closeNewSchedule.on('click', toggleNewSchedule);
/**
 * function to handle new schedule form submission
 * @param {*} e 
 */
function submitNewSheduleForm(e) {
    e.preventDefault();
    newScheduleForm.disableForm();
    notifier('Processing schedule, please wait...','default',null,'newScheduleNoti');
    let newScheduleData = _form.assembleFormData('#newScheduleForm');
    SET.ajax({
        url: this.attr('action'),
        method: this.attr('method'),
        body: newScheduleData,
        handler: (res, err) => {
            notifier(null,null,null,'newScheduleNoti');
            newScheduleForm.disableForm(false);
            if (err)
                return notifier(`${err.code ? err.code+': ' : ''}${err.msg}`,'error');
            const { error, errorMsg, data, force } = res;
            if (force) 
                return redirectFunc(force);
            if (error)
                return notifier(`${errorMsg}`,'error');
            if (data) {
                toggleNewSchedule();
                _form.reset('#newScheduleForm');
                notifier(data, 'success');
                fetchSchedule(null,null,true);
                return;
            }
            notifier('An error occurred processing request.','error');
        },
    });
}
newScheduleForm.on('submit', submitNewSheduleForm);

/**
 * delete scheduled event
 */
window.delSchEvent = function(e) {
    if (confirm('Do you want to delete scheduled event, this action cannot be reversed?')) {
        const elParent = e.currentTarget.getParent('sch-item__wrap');
        const dataId = elParent.attr('data-id');
        notifier('Processing request, please wait...','default',null,'delScheduleNoti');
        SET.ajax({
            url: `/schedule/delete/${dataId}`,
            method: 'DELETE',
            handler: (res, err) => {
                notifier(null,null,null,'delScheduleNoti');
                if (err)
                    return notifier(`${err.code ? err.code+': ' : ''}${err.msg}`,'error');
                const { error, errorMsg, data, force } = res;
                if (force) 
                    return redirectFunc(force);
                if (error)
                    return notifier(`${errorMsg}`,'error');
                if (data) {
                    return SET.removeElem(elParent);
                }
                notifier('An error occurred processing request.','error');
            },
        });
    }
};
