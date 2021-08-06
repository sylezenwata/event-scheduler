const DbInstance = require("../DB/db_connection");
const { DataTypes, QueryTypes } = require("sequelize");
const moment = require("moment");

const UserEventsModel = DbInstance.define(
    "user_events",
    {
        id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
        },
        event_name: {
			type: DataTypes.STRING,
			allowNull: false,
            validate: {
				function(value) {
					if (value.toString().trim() <= 0)
						throw new Error(`Please enter a valid event name.`);
				},
			},
		},
        event_location: {
			type: DataTypes.STRING,
			allowNull: true,
		},
        event_date: {
			type: DataTypes.DATE,
			allowNull: false,
			validate: {
				isDate: {
                    args: true,
                    msg: 'Please enter a valid event date.'
                }
			},
		},
        event_color: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        event_desc: {
			type: DataTypes.TEXT,
			allowNull: true,
            validate: {
				function(value) {
					if (value.toString().trim().length > 230)
						throw new Error(`Event description cannot be longer than 230 characters.`);
				},
			},
		},
        formatted_event_date: {
            type: DataTypes.STRING,
        },
        user: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        event_completed: {
            type: DataTypes.BOOLEAN,
			defaultValue: false,
        },
        user_notified: {
            type: DataTypes.BOOLEAN,
			defaultValue: false,
        },
        status: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		}
    },
    {
        hooks: {
            afterValidate: async (accountInstance) => {
                try {
                    let { event_date } = accountInstance;
                    accountInstance.formatted_event_date = moment(event_date).format('llll');
                } catch (error) {
                    console.log(`Format date:`, error);
                    throw error;
                }
            }
        }
    }
);

UserEventsModel.validUserEvent = async (event) => {
    let validUserEvent = await UserEventsModel.findOne({where: event});
    return validUserEvent ? validUserEvent : null;
};

UserEventsModel.addUserEvent = async ({event_name, event_color, event_location, event_date, event_desc, user}) => {
    if (
        await UserEventsModel.create({
            event_name,
            event_location,
            event_date,
            event_desc,
            event_color,
            user,
        })
    ) 
    {
        return true;
    }
    return null;
};

UserEventsModel.getUserEvents = async (start, limit, filter = null) => {
    // set filter
    let setTarget = start ? ` WHERE id < ${start} ` : ` `;
    let setLimit = limit ? ` LIMIT ${limit}` : ``;
    setTarget += (filter ? (start ? ` AND ` : ` WHERE `)+Object.keys(filter).map(e => `${e}=${filter[e]}`).join(' AND ')+` ` : ``);
    // run query
	return await DbInstance.query(
		`SELECT * FROM user_events${setTarget}ORDER BY id DESC${setLimit}`,
		{
			type: QueryTypes.SELECT,
		}
	);
};

UserEventsModel.searchUserEvents = async (query, limit, filter = null) => {
    // set filter
    let setFilter = filter ? ` AND ${Object.keys(filter).map(e => `${e}=${filter[e]}`).join(' AND ')} ` : ` `;
    return await DbInstance.query(
		`SELECT * FROM user_events WHERE (event_name LIKE :qry OR event_location LIKE :qry OR event_date LIKE :qry OR formatted_event_date LIKE :qry)${setFilter}ORDER BY id DESC LIMIT ${limit}`,
		{
            replacements: {qry: `%${query}%`},
			type: QueryTypes.SELECT,
		}
	);
};

UserEventsModel.deleteUserEvent = async (id) => {
    const validId = await UserEventsModel.validUserEvent({id});
    if (!validId) {
        throw new Error('Event does not exists.');
    }
    return await UserEventsModel.destroy({where: {id}}) ? validId : null;
}

UserEventsModel.sync({force: false})
    .then(() => {})
    .catch(e => console.log(`User Events Model Error: `, e));

module.exports = UserEventsModel;