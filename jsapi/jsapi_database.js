/**
 * Mock DB for testing.
 */
MockDB = function () {};
MockDB.prototype.open = function() {};
MockDB.prototype.getCircleEntity = function() {return new MockEntity()};
MockDB.prototype.getPersonEntity = function() {return new MockEntity()};
MockDB.prototype.getPersonCircleEntity = function() {return new MockEntity()};
MockDB.prototype.clearAll = function(callback) {};

/**
 * Storage class responsible for managing the database tansactions for Google+
 *
 * @constructor
 */
PlusDB = function () {
  this.db = null;
  this.circleEntity = null;
  this.personEntity = null;
  this.personCircleEntity = null;
};

/**
 * Opens a connection to Web SQL table.
 */
PlusDB.prototype.open = function() {
  // 10MB should fit around 100K otherwise would take time to expand array.
  var db_size = 10 * 1024 * 1024;
  this.db = openDatabase('Circle Management', '1.0', 'circle-manager', db_size);
  this.initializeEntities();
};

/**
 * Initialize the entities so we can have accessible tables in a fake ORM way.
 */
PlusDB.prototype.initializeEntities = function() {
  this.circleEntity = new CircleEntity(this.db);
  this.personEntity = new PersonEntity(this.db);
  this.personCircleEntity = new PersonCircleEntity(this.db);
};

/**
 * For simplicity, just show an alert when crazy error happens.
 */
PlusDB.prototype.onError = function(tx, e) {
  console.log('Error: ', e);
  alert('Something unexpected happened: ' + e.message );
};

/**
 * Removes every row from the table.
 */
PlusDB.prototype.clearAll = function(callback) {
  var self = this;
  // Drop them.
  self.personCircleEntity.drop(function() {
    self.circleEntity.drop(function() {
      self.personEntity.drop(function() {
        // Initialize them again.
        self.circleEntity.initialize(function() {
          self.personEntity.initialize(function() {
            self.personCircleEntity.initialize(function() {
              callback();
            });
          });
        });
      });
    });
  });
};

PlusDB.prototype.getCircleEntity = function() {
  return this.circleEntity;
};

PlusDB.prototype.getPersonEntity = function() {
  return this.personEntity;
};

PlusDB.prototype.getPersonCircleEntity = function() {
  return this.personCircleEntity;
};

// ---[ Begin Defining AbstractEntity ]-------------------------------------------------
/**
 * @constructor
 */
PersonEntity = function(db) {
  AbstractEntity.call(this, db, 'person');
};
JSAPIHelper.inherits(PersonEntity, AbstractEntity);

PersonEntity.prototype.tableDefinition = function() {
  return {
    id: 'TEXT NOT NULL',
    email: 'TEXT',
    name: 'TEXT NOT NULL',
    photo: 'TEXT',
    location: 'TEXT',
    employment: 'TEXT',
    occupation: 'TEXT',
    score: 'REAL',
    in_my_circle: 'CHAR DEFAULT "N"',
    added_me: 'CHAR DEFAULT "N"',
    unique: [
      ['id']
    ]
  };
};

/**
 * Replace implementation with custom full joined implementation with all tables.
 * @override
 */
PersonEntity.prototype.find = function(select, where, callback) {
  var self = this;
  var where = this.getWhereObject(where);
  var sql = 'SELECT person.id as id, person.email as email, person.name as name, person.photo as photo, ' +
      'person.location as location, person.employment as employment, person.occupation as occupation, ' +
      'person.score as score, person.in_my_circle as in_my_circle, person.added_me as added_me, ' +
      'circle.id as circle_id, circle.description as circle_description, circle.name as circle_name ' +
      'FROM person LEFT JOIN circle_person ON person.id = circle_person.person_id LEFT JOIN circle ON circle.id = circle_person.circle_id WHERE ' +
      where.keys.join(' AND ');
  this.db.readTransaction(function(tx) {
    tx.executeSql(sql, where.values, function (tx, rs) {
        var data = [];
        var prevID = null;
        for (var i = 0; i < rs.rows.length; i++) {
          var item = rs.rows.item(i);
          if (!item.id) {
            continue;
          }
          if (prevID == item.id) {
            data[data.length - 1].circles.push({
              id: item.circle_id,
              name: item.circle_name,
              description: item.circle_description
            });
          }
          else {
            prevID = item.id;
            data.push(item);
            data[data.length - 1].circles = [];
            if (item.circle_id) {
              data[data.length - 1].circles.push({
                id: item.circle_id,
                name: item.circle_name,
                description: item.circle_description
              });
            }
          }
        }
        self.fireCallback({status: true, data: data}, callback);
    }, function(tx, e) {
        console.error(self.name, 'Find', e.message);
        self.fireCallback({status: false, data: e.message}, callback);
    });
  });
};

/**
 * @constructor
 */
PersonCircleEntity = function(db) {
  AbstractEntity.call(this, db, 'circle_person');
};
JSAPIHelper.inherits(PersonCircleEntity, AbstractEntity);

PersonCircleEntity.prototype.tableDefinition = function() {
  return {
    circle_id: {type: 'TEXT', foreign: 'circle'},
    person_id: {type: 'TEXT', foreign: 'person'},
    unique: [
      ['circle_id', 'person_id']
    ]
  };
};

/**
 * @constructor
 */
CircleEntity = function(db) {
  AbstractEntity.call(this, db, 'circle');
};
JSAPIHelper.inherits(CircleEntity, AbstractEntity);

CircleEntity.prototype.tableDefinition = function() {
  return {
    id: 'TEXT NOT NULL',
    name: 'TEXT NOT NULL',
    position: 'TEXT',
    description: 'TEXT',
    unique: [
      ['id']
    ]
  };
};

/**
 * Replace implementation with custom full joined implementation with all tables.
 * @override
 */
CircleEntity.prototype.find = function(select, where, callback) {
  var self = this;
  var where = this.getWhereObject(where);
  var sql = ' SELECT circle.id as id, circle.name as name, circle.position as position, circle.description as description, count(circle_id) as count ' +
            ' FROM circle LEFT JOIN circle_person ON circle.id = circle_person.circle_id ' +
            ' WHERE ' + where.keys.join(' AND ') +
            ' GROUP BY id ORDER BY position';
 
  this.db.readTransaction(function(tx) {
    tx.executeSql(sql, where.values, function (tx, rs) {
        var data = [];
        for (var i = 0; i < rs.rows.length; i++) {
          data.push(rs.rows.item(i));
        }
        self.fireCallback({status: true, data: data}, callback);
      }, function(tx, e) {
        console.error(self.name, 'Find', e.message);
        self.fireCallback({status: false, data: e.message}, callback);
      }
    );
  });
};
// ---[ End Defining AbstractEntity ]-------------------------------------------------
