/*jshint indent:2, curly:true eqeqeq:true, immed:true, latedef:true,
newcap:true, noarg:true, regexp:true, undef:true, strict:true, trailing:true
white:true*/
/*global XT:true, XM:true, Backbone:true, _:true, console:true */

(function () {
  "use strict";

  /**
    @class

    @extends XM.Document
  */
  XM.CostCategory = XM.Document.extend(/** @lends XM.CostCategory.prototype */{

    recordType: 'XM.CostCategory',

    documentKey: "code"

  });

  /**
    @class

    @extends XM.Document
  */
  XM.PlannerCode = XM.Document.extend(/** @lends XM.PlannerCode.prototype */{

    recordType: 'XM.PlannerCode',

    documentKey: "code"

  });


  /**
    @class

    @extends XM.Document
  */
  XM.ItemSite = XM.Model.extend(/** @lends XM.ItemSite.prototype */{

    recordType: 'XM.ItemSite',

    defaults: {
      isActive: true
    },

    requiredAttributes: [
      "id",
      "plannerCode",
      "costCategory"
    ],

    /**
      Users must not be able to set the site except for new itemsites
     */
    initialize: function () {
      XM.Model.prototype.initialize.apply(this, arguments);
      var isReadOnly = this.getStatus() !== XM.Model.READY_NEW;
      this.setReadOnly('item', isReadOnly);
      this.setReadOnly('site', isReadOnly);
    }

    // TODO: if the user selects an already-used item and site combination, he
    // gets an error from the database
  });

  /**
    @class

    @extends XM.Comments
  */
  XM.ItemSiteComment = XM.Comment.extend(/** @lends XM.ItemSiteComment.prototype */{

    recordType: 'XM.ItemSiteComment',

    sourceName: 'IS'

  });

  /**
    @class

    @extends XM.Info
  */
  XM.ItemSiteRelation = XM.Info.extend(/** @lends XM.ItemSiteRelation.prototype */{

    recordType: 'XM.ItemSiteRelation',

    editableModel: 'XM.ItemSite'

  });


  /**
    @class

    @extends XM.Info
  */
  XM.ItemSiteListItem = XM.Info.extend(/** @lends XM.ItemSiteListItem.prototype */{

    recordType: 'XM.ItemSiteListItem',

    editableModel: 'XM.ItemSite'

  });

  _.extend(XM.ItemSiteListItem, /** @lends XM.ItemSiteListItem# */{
    /**
      Item site has no searchable attributes by default, so we have to provide some, or
      errors occur (e.g. the search screen)
     */
    getSearchableAttributes: function () {
      return ["item.number", "site.code"];
    }
  });

  // ..........................................................
  // COLLECTIONS
  //

  /**
    @class

    @extends XM.Collection
  */
  XM.CostCategoryCollection = XM.Collection.extend(/** @lends XM.CostCategoryCollection.prototype */{

    model: XM.CostCategory

  });

  /**
    @class

    @extends XM.Collection
  */
  XM.PlannerCodeCollection = XM.Collection.extend(/** @lends XM.PlannerCodeCollection.prototype */{

    model: XM.PlannerCode

  });

  /**
    @class

    @extends XM.Collection
  */
  XM.ItemSiteCollection = XM.Collection.extend(/** @lends XM.ItemSiteCollection.prototype */{

    model: XM.ItemSite

  });

  /**
    If we have a special extra filter enabled, we need to perform a dispatch
    instead of a fetch to get the data we need. This is because we only want
    to show items that are associated with particular customers, shiptos,
    or effective dates.
   */
  var fetch = function (options) {
    options = options ? options : {};
    var that = this,
      params = options.query ? options.query.parameters : [],
      param = _.findWhere(params, {attribute: "customer"}),
      customerId,
      shiptoId,
      effectiveDate,
      success,
      omit = function (params, attr) {
        return _.filter(params, function (param) {
          return param.attribute !== attr;
        });
      };

    if (param) {

      // We have to do a special dispatch to fetch the data based on customer.
      // Because it's a dipatch call and not a fetch, the collection doesn't get
      // updated automatically. We have to do that by hand on success.
      customerId = param.value.id;
      params = omit(params, "customer");

      // Find shipto
      param = _.findWhere(params, {attribute: "shipto"});
      if (param) {
        shiptoId = param.value.id;
        params = omit(params, "shipto");
      }

      // Find effective Date
      param = _.findWhere(params, {attribute: "effectiveDate"});
      if (param) {
        effectiveDate = param ? param.value : null;
        params = omit(params, "effectiveDate");
      }
      options.query.parameters = params;
      XT.dataSource.formatParameters("XM.ItemSite", options.query.parameters);

      // Dispatch the query
      success = options.success;
      options.success = function (data) {
        that.reset(data);
        if (success) { success(data); }
      };
      XT.dataSource.dispatch("XM.ItemSite", "itemsForCustomer",
        [customerId, shiptoId, effectiveDate, options.query], options);

    } else {
      // Otherwise just do a normal fetch
      XM.Collection.prototype.fetch.call(this, options);
    }
  };

  /**
    @class

    @extends XM.Collection
  */
  XM.ItemSiteRelationCollection = XM.Collection.extend(/** @lends XM.ItemSiteRelationCollection.prototype */{

    model: XM.ItemSiteRelation,

    fetch: fetch,

    comparator: function (itemSite) {
      var defaultSiteId = this.defaultSite ? this.defaultSite.id : -5;
      var defaultSiteOrder = itemSite.getValue("site.id") === defaultSiteId ? 'aa' : 'zz';
      return itemSite.getValue("item.number") + defaultSiteOrder + itemSite.getValue("site.code");
    }

  });

  /**
    @class

    @extends XM.Collection
  */
  XM.ItemSiteListItemCollection = XM.Collection.extend(/** @lends XM.ItemSiteListItemCollection.prototype */{

    model: XM.ItemSiteListItem,

    fetch: fetch

  });

}());
